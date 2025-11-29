import conflictDatabase from '../data/conflict-database.json';

export interface DesignParams {
    private_space_m2: number;
    integration_level: number; // 0-100
    rent_price: number;
    standard_level: number; // 0-100
    rules_strictness: number; // 0-100
}

export interface SimulationResult {
    scenario: string;
    narrative: string;
    impact: {
        satisfaction: number;
        financial_health: number;
        social_cohesion: number;
    };
    triggered_conflicts: string[];
}

export interface FeasibilityScore {
    score: number; // 0-100
    breakdown: {
        financial: number;
        social: number;
        legal: number;
    };
    warnings: string[];
}

export class SimulationEngine {
    private conflicts: any[];

    constructor() {
        this.conflicts = conflictDatabase;
    }

    /**
     * Calculates the overall feasibility of the proposed design.
     */
    public calculateFeasibility(params: DesignParams): FeasibilityScore {
        let financialScore = 100;
        let socialScore = 100;
        let legalScore = 100;
        const warnings: string[] = [];

        // 1. Financial Check
        // Simple model: Rent must cover "Standard" costs.
        // Base cost = 1000 + (standard_level * 15) + (private_space_m2 * 50)
        const estimatedCost = 1000 + (params.standard_level * 15) + (params.private_space_m2 * 50);
        if (params.rent_price < estimatedCost) {
            financialScore -= 30;
            warnings.push(`Rent (${params.rent_price}) is too low to cover estimated costs (${estimatedCost}).`);
        } else if (params.rent_price > estimatedCost * 1.5) {
            financialScore -= 10; // Profitable but maybe too expensive
            warnings.push(`Rent is significantly higher than costs, risking vacancy.`);
        }

        // 2. Social Check (Conflict Triggers)
        this.conflicts.forEach(conflict => {
            const { metric, condition, value } = conflict.trigger;
            let triggered = false;

            // @ts-ignore - dynamic access
            const paramValue = params[metric];

            if (paramValue !== undefined) {
                if (condition === '<' && paramValue < value) triggered = true;
                if (condition === '>' && paramValue > value) triggered = true;
                if (condition === '==' && paramValue === value) triggered = true;
            }

            if (triggered) {
                socialScore -= 15;
                warnings.push(`Conflict Risk: ${conflict.category} - ${conflict.consequence.description}`);
            }
        });

        // 3. Legal Check (Mock)
        if (params.private_space_m2 < 5) {
            legalScore = 0;
            warnings.push('ILLEGAL: Private space is below minimum legal requirement (5m2).');
        }

        const totalScore = Math.max(0, Math.min(100, (financialScore * 0.4 + socialScore * 0.4 + legalScore * 0.2)));

        return {
            score: Math.round(totalScore),
            breakdown: {
                financial: Math.max(0, financialScore),
                social: Math.max(0, socialScore),
                legal: Math.max(0, legalScore)
            },
            warnings
        };
    }

    /**
     * Runs a specific crisis simulation scenario.
     */
    public runCrisisSimulation(scenario: 'pandemic' | 'inflation' | 'neighbor', params: DesignParams): SimulationResult {
        let satisfactionChange = 0;
        let financialChange = 0;
        let cohesionChange = 0;
        let narrative = '';
        const triggeredConflicts: string[] = [];

        switch (scenario) {
            case 'pandemic':
                narrative = "A new wave of a virus forces a 2-month lockdown. Residents are confined to their units.";
                if (params.private_space_m2 < 15) {
                    satisfactionChange -= 40;
                    narrative += " Small private units lead to severe cabin fever and mental health struggles.";
                } else {
                    satisfactionChange -= 10;
                    narrative += " Larger private units help residents cope reasonably well.";
                }

                if (params.integration_level > 80) {
                    cohesionChange += 10;
                    narrative += " Strong pre-existing community bonds help organize mutual aid (shopping for seniors).";
                }
                break;

            case 'inflation':
                narrative = "Energy prices spike by 40%, driving up operational costs.";
                financialChange -= 30;
                if (params.rent_price > 3000) {
                    narrative += " High rent combined with inflation causes 20% of residents to give notice.";
                    cohesionChange -= 20;
                } else {
                    narrative += " Affordable rent allows most residents to weather the storm, though budgets are tight.";
                }
                break;

            case 'neighbor':
                narrative = "A local neighborhood group files a complaint about noise and parking.";
                if (params.integration_level > 70) {
                    narrative += " Frequent parties and events have antagonized the neighbors. Legal action is threatened.";
                    financialChange -= 10; // Legal fees
                    cohesionChange -= 10;
                } else {
                    narrative += " The quiet nature of the community makes the complaints easy to dismiss.";
                }
                break;
        }

        return {
            scenario,
            narrative,
            impact: {
                satisfaction: satisfactionChange,
                financial_health: financialChange,
                social_cohesion: cohesionChange
            },
            triggered_conflicts: triggeredConflicts
        };
    }
}

export default new SimulationEngine();
