import express, { Request, Response } from 'express';
import simulationEngine, { DesignParams } from '../services/simulation-engine';
import designService from '../services/design-service';

const router = express.Router();

/**
 * POST /api/v2/workshop/audit
 * Audits the current design parameters and returns a feasibility score.
 */
router.post('/audit', (req: Request, res: Response) => {
    try {
        const params: DesignParams = req.body;

        // Basic validation
        if (params.private_space_m2 === undefined || params.rent_price === undefined) {
            return res.status(400).json({ success: false, message: "Missing required design parameters" });
        }

        const result = simulationEngine.calculateFeasibility(params);
        return res.json({ success: true, data: result });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/v2/workshop/simulate
 * Runs a crisis simulation based on the design.
 */
router.post('/simulate', (req: Request, res: Response) => {
    try {
        const { scenario, params } = req.body;

        if (!scenario || !params) {
            return res.status(400).json({ success: false, message: "Missing scenario or design parameters" });
        }

        const result = simulationEngine.runCrisisSimulation(scenario, params);
        return res.json({ success: true, data: result });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

import reportGenerator from '../services/report-generator';

// ... existing imports

/**
 * POST /api/v2/workshop/report
 * Generates a PDF report.
 */
router.post('/report', async (req: Request, res: Response) => {
    try {
        const { municipalityName, params, score, simulation } = req.body;

        if (!municipalityName || !params || !score) {
            return res.status(400).json({ success: false, message: "Missing required report data" });
        }

        const pdfBuffer = await reportGenerator.generateReport(municipalityName, params, score, simulation);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=feasibility_study_${Date.now()}.pdf`);
        return res.send(pdfBuffer);
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/v2/data/demographics/:districtId
 * Returns mock demographic data for a district.
 */
router.get('/data/demographics/:districtId', (req: Request, res: Response) => {
    const { districtId } = req.params;

    // Mock data generator based on district ID
    const mockData = {
        districtId,
        population: 12500,
        age_structure: {
            "0-18": 15,
            "19-35": 25,
            "36-60": 35,
            "60+": 25
        },
        dominant_household: "Single pensioner",
        average_income: 4200,
        needs_heatmap: {
            "affordable_housing": "High",
            "green_space": "Medium",
            "senior_care": "Critical"
        }
    };

    res.json({ success: true, data: mockData });
});

/**
 * GET /api/v2/workshop/designs
 * List all saved designs.
 */
router.get('/designs', async (req: Request, res: Response) => {
    try {
        // TODO: Get userId from auth middleware if available
        const userId = undefined;
        const designs = await designService.getDesigns(userId);
        return res.json({ success: true, data: designs });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/v2/workshop/designs
 * Save a new design.
 */
router.post('/designs', async (req: Request, res: Response) => {
    try {
        const { name, description, parameters, isPublic } = req.body;

        if (!name || !parameters) {
            return res.status(400).json({ success: false, message: "Missing name or parameters" });
        }

        // TODO: Get userId from auth middleware
        const createdBy = undefined;

        const design = await designService.createDesign({
            name,
            description,
            parameters,
            isPublic,
            createdBy
        });

        return res.json({ success: true, data: design });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/v2/workshop/designs/:id
 * Get a specific design.
 */
router.get('/designs/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const design = await designService.getDesignById(id);

        if (!design) {
            return res.status(404).json({ success: false, message: "Design not found" });
        }

        return res.json({ success: true, data: design });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
