# AI-Powered Co-Living Design Workshop

**Theme:** Designing the Future of Shared Living in Polish Municipalities
**Participants:** ~10 people (Municipal officials, Urban planners, Architects, Community leaders)
**Duration:** 3-4 Hours

## 1. Executive Summary

This workshop leverages Generative AI to transform the traditional participatory design process. Instead of static sticky notes, participants interact with a "Digital Co-Facilitator" that provides real-time data synthesis, persona simulation, and conflict mediation. The goal is to design a viable, community-centric co-living model for a specific municipality.

## 2. Core Concepts (Derived from Research)

* **Hybrid Intelligence:** Combining human empathy/local knowledge with AI's analytical/generative capabilities.
* **Conflict-Centric Design:** Directly addressing trade-offs (e.g., "Space vs. Individual", "Control vs. Freedom") identified in *test_coliving1.pdf*.
* **Rapid Prototyping:** Using AI to instantly visualize and validate ideas.

## 3. Workshop Agenda

### Module 1: The "Living" Context (30 min)

* **Activity:** "Data-Driven Empathy"
* **Process:**
    1. Facilitator presents a specific municipal challenge (e.g., "Aging population in City X").
    2. **AI Role:** AI generates 3 distinct "Resident Personas" (e.g., *Mrs. Jadwiga, 75, lonely but independent*; *Tomek, 24, student, needs cheap housing*).
    3. **Interaction:** Participants ask the AI Personas questions to understand their deep needs (e.g., "Mrs. Jadwiga, how do you feel about sharing a kitchen?").
* **Outcome:** Deep, verified understanding of user needs.

### Module 2: The Co-Living Configuration (60 min)

* **Activity:** "Building the System"
* **Process:**
    1. Participants split into 2 groups of 5.
    2. They define the "Hardware" (Space) and "Software" (Rules/Culture).
    3. **Key Decision Points:**
        * *Private vs. Shared Ratio*
        * *Governance Model* (Strict vs. Laissez-faire)
        * *Integration Activities*
    4. **AI Role:** "Real-time Critic". As groups input decisions, the AI flags potential issues based on the Personas from Module 1 (e.g., "Warning: Your strict noise policy conflicts with Tomek's lifestyle").
* **Outcome:** Two distinct co-living prototypes.

### Module 3: The Conflict Arena (45 min)

* **Activity:** "Solving the Unsolvable"
* **Process:**
    1. Facilitator introduces specific conflicts from *test_coliving1.pdf*:
        * *Space vs. Individual Fitness*
        * *Simple Rules vs. Complex Needs*
        * *Community Mission vs. Introversion*
    2. **AI Role:** "The Mediator". AI proposes 3 radical solutions for each conflict.
    3. **Task:** Groups must debate the AI's proposals and select/modify one to adopt.
* **Outcome:** Robust solutions to common co-living pitfalls.

### Module 4: The Future Simulation (45 min)

* **Activity:** "A Year in the Life"
* **Process:**
    1. Groups finalize their designs.
    2. **AI Role:** "The Simulator". The AI runs a simulation of "Year 1" in the community.
    3. **Output:** A narrative story describing successes (e.g., "Community garden flourished") and crises (e.g., "Conflict over kitchen cleanliness escalated in Month 3").
    4. **Debrief:** Groups discuss how to mitigate the simulated crises.
* **Outcome:** Stress-tested concepts ready for further development.

## 4. Technical Requirements (CMS Features)

To support this workshop, the WorkshopsAI CMS needs:

1. **Persona Chat Interface:** A view where participants can chat with specific AI personas.
2. **Live Dashboard:** A screen for the facilitator to show real-time summaries and "Word Clouds" (as mentioned in *sharedliving AI samorządy.pdf*).
3. **Scenario Generator:** Backend logic to generate the "Year 1 Simulation" based on workshop inputs.
4. **Input Forms:** Digital forms for groups to submit their design parameters.

## 5. Next Steps

1. **Develop the "Persona Chat" Prototype:** A simple interface to query pre-prompted LLMs.
2. **Create the "Conflict Database":** Digitize the conflicts from *test_coliving1.pdf* into the CMS.
3. **Design the Facilitator Dashboard:** For controlling the flow and displaying AI insights.
