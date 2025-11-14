/**
 * Component Testing Setup
 * Setup for Web Components and Lit element testing with Happy DOM
 */

import { expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { Window } from 'happy-dom'

// Happy DOM window instance
let window: Window

beforeAll(() => {
  // Create Happy DOM window for component testing
  window = new Window({
    width: 1024,
    height: 768,
    settings: {
      disableJavaScriptEvaluation: false,
      disableJavaScriptFileLoading: false,
      disableCSSFileLoading: false,
      disableComputedStyleRendering: false,
      enableFileSystemHttpRequests: false
    }
  })

  // Set up global variables for component testing
  global.window = window
  global.document = window.document
  global.navigator = window.navigator
  global.HTMLElement = window.HTMLElement
  global.CustomEvent = window.CustomEvent
  global.Event = window.Event
  global.MouseEvent = window.MouseEvent
  global.KeyboardEvent = window.KeyboardEvent
  global.FocusEvent = window.FocusEvent
  global.DragEvent = window.DragEvent
  global.TouchEvent = window.TouchEvent
  global.WebComponents = {
    ready: true,
    flush: vi.fn()
  }

  // Mock LitElement and related utilities
  global.LitElement = class MockLitElement extends window.HTMLElement {
    static properties: Record<string, any> = {}
    static styles: any = null

    properties: Record<string, any> = {}
    _updateProperties: boolean = true
    _needsRender: boolean = false

    constructor() {
      super()
      this.attachShadow({ mode: 'open' })
    }

    requestUpdate(name?: string, oldValue?: any) {
      this._needsRender = true
      Promise.resolve().then(() => {
        if (this._needsRender) {
          this.performUpdate()
        }
      })
    }

    performUpdate() {
      if (!this._needsRender) return

      this._needsRender = false
      this.update()
      this.render()
    }

    update() {
      // Override in subclasses
    }

    render() {
      // Override in subclasses
      return this.nothing
    }

    get nothing() {
      return null
    }

    get html() {
      return (strings: TemplateStringsArray, ...values: any[]) => {
        return strings.reduce((result, string, i) => {
          return result + string + (values[i] || '')
        }, '')
      }
    }

    get css() {
      return (strings: TemplateStringsArray, ...values: any[]) => {
        return strings.reduce((result, string, i) => {
          return result + string + (values[i] || '')
        }, '')
      }
    }

    connectedCallback() {
      this.performUpdate()
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
      this.requestUpdate(name, oldValue)
    }

    createRenderRoot() {
      return this.shadowRoot!
    }
  }

  // Mock @lit/reactive-element
  global.ReactiveElement = global.LitElement

  // Mock lit-html
  global.litHtml = {
    html: (strings: TemplateStringsArray, ...values: any[]) => {
      return strings.reduce((result, string, i) => {
        return result + string + (values[i] || '')
      }, '')
    },
    render: vi.fn(),
    nothing: Symbol('nothing'),
    noChange: Symbol('noChange')
  }

  // Mock lit decorators
  global.customElements = {
    define: vi.fn(),
    get: vi.fn(),
    upgrade: vi.fn(),
    whenDefined: vi.fn().mockResolvedValue(undefined)
  }

  // Mock Web Components support
  global.ShadowRoot = window.ShadowRoot
  global.ElementInternals = class MockElementInternals {}
})

afterEach(() => {
  // Clean up after each test
  window.document.body.innerHTML = ''
  window.document.head.innerHTML = ''

  // Clear all component instances
  vi.clearAllMocks()

  // Reset any custom element definitions
  if (global.customElements && global.customElements.define.mockReset) {
    global.customElements.define.mockReset()
  }
})

afterAll(() => {
  // Cleanup Happy DOM instance
  if (window && window.close) {
    window.close()
  }
})

// Component testing utilities
export class ComponentTestingUtils {
  static async createElement<T extends HTMLElement>(
    tagName: string,
    properties: Record<string, any> = {},
    attributes: Record<string, string> = {}
  ): Promise<T> {
    const element = window.document.createElement(tagName) as T

    // Set properties
    Object.entries(properties).forEach(([key, value]) => {
      (element as any)[key] = value
    })

    // Set attributes
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value)
    })

    // Trigger connected callback
    window.document.body.appendChild(element)

    // Wait for any async rendering
    await ComponentTestingUtils.waitForRender(element)

    return element
  }

  static async waitForRender(element: HTMLElement, timeout = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const checkRender = () => {
        if (element.shadowRoot && element.shadowRoot.children.length > 0) {
          resolve()
          return
        }

        if (element.children.length > 0) {
          resolve()
          return
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Element did not render within ${timeout}ms`))
          return
        }

        setTimeout(checkRender, 10)
      }

      checkRender()
    })
  }

  static async fireEvent(
    element: HTMLElement,
    eventType: string,
    eventInit: EventInit = {}
  ): Promise<Event> {
    const event = new window.Event(eventType, {
      bubbles: true,
      cancelable: true,
      ...eventInit
    })

    element.dispatchEvent(event)
    return event
  }

  static async clickElement(element: HTMLElement): Promise<void> {
    const event = new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0
    })

    element.dispatchEvent(event)
  }

  static async typeText(element: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
    element.focus()

    for (const char of text) {
      const keyEvent = new window.KeyboardEvent('keydown', {
        key: char,
        bubbles: true,
        cancelable: true
      })

      element.dispatchEvent(keyEvent)
      element.value += char

      const inputEvent = new window.Event('input', {
        bubbles: true,
        cancelable: true
      })

      element.dispatchEvent(inputEvent)
    }

    const changeEvent = new window.Event('change', {
      bubbles: true,
      cancelable: true
    })

    element.dispatchEvent(changeEvent)
  }

  static getShadowContent(element: HTMLElement): string {
    if (element.shadowRoot) {
      return element.shadowRoot.innerHTML
    }
    return element.innerHTML
  }

  static getShadowSelector(element: HTMLElement, selector: string): Element | null {
    if (element.shadowRoot) {
      return element.shadowRoot.querySelector(selector)
    }
    return element.querySelector(selector)
  }

  static getShadowSelectorAll(element: HTMLElement, selector: string): NodeListOf<Element> {
    if (element.shadowRoot) {
      return element.shadowRoot.querySelectorAll(selector)
    }
    return element.querySelectorAll(selector)
  }

  static async waitForElement(
    container: HTMLElement,
    selector: string,
    timeout = 5000
  ): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = container.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver(() => {
        const element = container.querySelector(selector)
        if (element) {
          observer.disconnect()
          resolve(element)
        }
      })

      observer.observe(container, {
        childList: true,
        subtree: true
      })

      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Element ${selector} not found within ${timeout}ms`))
      }, timeout)
    })
  }

  static expectElementToExist(container: HTMLElement, selector: string) {
    const element = container.querySelector(selector)
    expect(element).toBeTruthy()
    return element
  }

  static expectElementToNotExist(container: HTMLElement, selector: string) {
    const element = container.querySelector(selector)
    expect(element).toBeFalsy()
  }

  static expectElementToHaveText(container: HTMLElement, selector: string, expectedText: string) {
    const element = container.querySelector(selector)
    expect(element).toBeTruthy()
    expect(element?.textContent).toContain(expectedText)
  }

  static expectElementToHaveClass(container: HTMLElement, selector: string, className: string) {
    const element = container.querySelector(selector) as HTMLElement
    expect(element).toBeTruthy()
    expect(element?.classList.contains(className)).toBe(true)
  }

  static expectElementToHaveAttribute(container: HTMLElement, selector: string, attribute: string, value?: string) {
    const element = container.querySelector(selector)
    expect(element).toBeTruthy()
    if (value !== undefined) {
      expect(element?.getAttribute(attribute)).toBe(value)
    } else {
      expect(element?.hasAttribute(attribute)).toBe(true)
    }
  }

  static async expectElementToBeVisible(container: HTMLElement, selector: string) {
    const element = container.querySelector(selector) as HTMLElement
    expect(element).toBeTruthy()
    expect(element?.style.display).not.toBe('none')
    expect(element?.style.visibility).not.toBe('hidden')
  }

  static async expectElementToBeHidden(container: HTMLElement, selector: string) {
    const element = container.querySelector(selector) as HTMLElement
    expect(element).toBeTruthy()
    const computedStyle = window.getComputedStyle(element!)
    expect(computedStyle.display).toBe('none') || expect(computedStyle.visibility).toBe('hidden')
  }
}

// Accessibility testing utilities
export class AccessibilityTestingUtils {
  static async checkAccessibility(element: HTMLElement): Promise<boolean> {
    // Basic accessibility checks
    const issues: string[] = []

    // Check for alt text on images
    const images = element.querySelectorAll('img')
    images.forEach((img, index) => {
      if (!img.alt) {
        issues.push(`Image ${index} is missing alt text`)
      }
    })

    // Check for proper form labels
    const inputs = element.querySelectorAll('input, textarea, select')
    inputs.forEach((input, index) => {
      const hasLabel = input.hasAttribute('aria-label') ||
                      input.hasAttribute('aria-labelledby') ||
                      element.querySelector(`label[for="${input.id}"]`)

      if (!hasLabel) {
        issues.push(`Input ${index} is missing label`)
      }
    })

    // Check for button accessibility
    const buttons = element.querySelectorAll('button')
    buttons.forEach((button, index) => {
      if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
        issues.push(`Button ${index} is missing accessible name`)
      }
    })

    // Check for proper heading hierarchy
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6')
    let lastLevel = 0
    headings.forEach((heading) => {
      const currentLevel = parseInt(heading.tagName.charAt(1))
      if (currentLevel > lastLevel + 1) {
        issues.push(`Skipping heading level from h${lastLevel} to ${heading.tagName}`)
      }
      lastLevel = currentLevel
    })

    return issues.length === 0
  }

  static async getAccessibilityReport(element: HTMLElement): Promise<{
    passed: boolean
    issues: string[]
    score: number
  }> {
    const issues: string[] = []
    let totalChecks = 0
    let passedChecks = 0

    // Image alt text check
    const images = element.querySelectorAll('img')
    totalChecks += images.length
    images.forEach((img) => {
      if (img.alt) passedChecks++
      else issues.push('Image missing alt text')
    })

    // Form label check
    const inputs = element.querySelectorAll('input, textarea, select')
    totalChecks += inputs.length
    inputs.forEach((input) => {
      const hasLabel = input.hasAttribute('aria-label') ||
                      input.hasAttribute('aria-labelledby') ||
                      element.querySelector(`label[for="${input.id}"]`)
      if (hasLabel) passedChecks++
      else issues.push('Input missing label')
    })

    // Button accessibility check
    const buttons = element.querySelectorAll('button')
    totalChecks += buttons.length
    buttons.forEach((button) => {
      const hasAccessibleName = button.textContent?.trim() ||
                               button.getAttribute('aria-label')
      if (hasAccessibleName) passedChecks++
      else issues.push('Button missing accessible name')
    })

    const score = totalChecks > 0 ? (passedChecks / totalChecks) * 100 : 100

    return {
      passed: issues.length === 0,
      issues,
      score: Math.round(score)
    }
  }
}

export { ComponentTestingUtils, AccessibilityTestingUtils }