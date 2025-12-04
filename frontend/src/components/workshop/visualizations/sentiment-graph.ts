import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import Chart from 'chart.js/auto';

@customElement('workshop-sentiment-graph')
export class WorkshopSentimentGraph extends LitElement {
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
    impact: { [key: string]: number } = {};

    @query('canvas')
    canvas!: HTMLCanvasElement;

    private chart: Chart | null = null;

    override updated(changedProperties: PropertyValues) {
        if (changedProperties.has('impact') && this.canvas) {
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
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Simulation Impact',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMin: -50,
                        suggestedMax: 50,
                        grid: {
                            color: (context) => context.tick.value === 0 ? '#000' : 'rgba(0, 0, 0, 0.1)',
                            lineWidth: (context) => context.tick.value === 0 ? 2 : 1,
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });

        this.updateChart();
    }

    private updateChart() {
        if (!this.chart || !this.impact) return;

        const labels = Object.keys(this.impact).map(k => k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
        const values = Object.values(this.impact);

        const colors = values.map(v => v >= 0 ? 'rgba(75, 192, 192, 0.6)' : 'rgba(255, 99, 132, 0.6)');
        const borders = values.map(v => v >= 0 ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)');

        this.chart.data.labels = labels;
        if (this.chart.data.datasets[0]) {
            this.chart.data.datasets[0].data = values;
            this.chart.data.datasets[0].backgroundColor = colors;
            this.chart.data.datasets[0].borderColor = borders;
        }

        this.chart.update();
    }

    override render() {
        return html`<canvas></canvas>`;
    }
}
