import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import Chart from 'chart.js/auto';

@customElement('workshop-radar-chart')
export class WorkshopRadarChart extends LitElement {
    static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 300px;
    }
    canvas {
      width: 100%;
      height: 100%;
    }
  `;

    @property({ type: Object })
    data: { [key: string]: number } = {};

    @query('canvas')
    canvas!: HTMLCanvasElement;

    private chart: Chart | null = null;

    override updated(changedProperties: PropertyValues) {
        if (changedProperties.has('data') && this.canvas) {
            this.updateChart();
        }
    }

    override firstUpdated() {
        this.initChart();
    }

    private initChart() {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        this.chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Design Profile',
                    data: [],
                    fill: true,
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    borderColor: 'rgb(37, 99, 235)',
                    pointBackgroundColor: 'rgb(37, 99, 235)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(37, 99, 235)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                elements: {
                    line: {
                        borderWidth: 3
                    }
                },
                scales: {
                    r: {
                        angleLines: {
                            display: true
                        },
                        suggestedMin: 0,
                        suggestedMax: 100
                    }
                }
            }
        });

        this.updateChart();
    }

    private updateChart() {
        if (!this.chart || !this.data) return;

        const labels = Object.keys(this.data).map(k => k.charAt(0).toUpperCase() + k.slice(1));
        const values = Object.values(this.data);

        this.chart.data.labels = labels;
        if (this.chart.data.datasets[0]) {
            this.chart.data.datasets[0].data = values;
        }
        this.chart.update();
    }

    override render() {
        return html`<canvas></canvas>`;
    }
}
