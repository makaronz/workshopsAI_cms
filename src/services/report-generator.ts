import PDFDocument from 'pdfkit';
import { DesignParams, FeasibilityScore, SimulationResult } from './simulation-engine';

export class ReportGenerator {
    public async generateReport(
        municipalityName: string,
        params: DesignParams,
        score: FeasibilityScore,
        simulation?: SimulationResult
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const buffers: Buffer[] = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Title
            doc.fontSize(25).text('Preliminary Co-Living Feasibility Study', { align: 'center' });
            doc.moveDown();
            doc.fontSize(18).text(`Municipality: ${municipalityName}`, { align: 'center' });
            doc.moveDown();
            doc.fontSize(12).text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
            doc.moveDown(2);

            // Executive Summary
            doc.fontSize(16).text('1. Executive Summary');
            doc.fontSize(12).text(
                `This report analyzes the feasibility of a proposed co-living development. ` +
                `The overall feasibility score is ${score.score}/100.`
            );
            doc.moveDown();

            // Design Parameters
            doc.fontSize(16).text('2. Design Parameters');
            doc.fontSize(12).list([
                `Private Space: ${params.private_space_m2} m²`,
                `Integration Level: ${params.integration_level}%`,
                `Rent Price: ${params.rent_price} PLN`,
                `Standard Level: ${params.standard_level}%`
            ]);
            doc.moveDown();

            // Feasibility Breakdown
            doc.fontSize(16).text('3. Feasibility Analysis');
            doc.fontSize(12).text('Breakdown by Category:');
            doc.list([
                `Financial Viability: ${score.breakdown.financial}/100`,
                `Social Cohesion: ${score.breakdown.social}/100`,
                `Legal Compliance: ${score.breakdown.legal}/100`
            ]);
            doc.moveDown();

            if (score.warnings.length > 0) {
                doc.fillColor('red').text('Identified Risks:');
                doc.list(score.warnings);
                doc.fillColor('black');
            }
            doc.moveDown();

            // Simulation Results
            if (simulation) {
                doc.addPage();
                doc.fontSize(16).text('4. Stress Test Simulation');
                doc.fontSize(14).text(`Scenario: ${simulation.scenario.toUpperCase()}`);
                doc.moveDown();
                doc.fontSize(12).text(simulation.narrative, { align: 'justify' });
                doc.moveDown();

                doc.text('Impact Analysis:');
                doc.list([
                    `Satisfaction Change: ${simulation.impact.satisfaction}`,
                    `Financial Health Change: ${simulation.impact.financial_health}`,
                    `Social Cohesion Change: ${simulation.impact.social_cohesion}`
                ]);
            }

            doc.end();
        });
    }
}

export default new ReportGenerator();
