... 
174       triggeredBy: jobData.triggeredBy,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
175     });
    ~~~~~~

  node_modules/drizzle-orm/pg-core/query-builders/insert.d.ts:29:101
     29 export type PgInsertValue<TTable extends PgTable<TableConfig>, OverrideT extends boolean = false> = {
                                                                                                            ~
     30     [Key in keyof InferInsertModel<TTable, {
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    ... 
     36     }>[Key] | SQL | Placeholder;
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
     37 } & {};
        ~
    The expected type comes from property 'triggeredBy' which is declared here on type '{ questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisTypes: SQL<unknown> | string[] | Placeholder<string, any>; id?: string | SQL<...> | Placeholder<...>; ... 15 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }'

src/services/llm-worker.ts:199:7 - error TS2322: Type 'string | number | true | object' is not assignable to type 'number'.
  Type 'string' is not assignable to type 'number'.

199       progress: job.progress || 0,
          ~~~~~~~~

  src/services/llm-worker.ts:186:5
    186     progress: number;
            ~~~~~~~~
    The expected type comes from property 'progress' which is declared here on type '{ id: string; status: string; progress: number; data?: any; result?: any; error?: string; }'

src/services/llm-worker.ts:298:13 - error TS2769: No overload matches this call.
  Overload 2 of 2, '(values: { questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisType: SQL<unknown> | "thematic" | "clusters" | "contradictions" | "insights" | "recommendations" | Placeholder<...>; ... 8 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }[]): PgInsertBase<...>', gave the following error.
    Argument of type '{ id: string; questionnaireId: string; analysisType: string; status: string; results: any; metadata: { model: string; promptVersion: string; tokensUsed: number; processingTimeMs: number; confidenceScore: number; responseCount: number; }; triggeredBy: number; completedAt: Date; }' is not assignable to parameter of type '{ questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisType: SQL<unknown> | "thematic" | "clusters" | "contradictions" | "insights" | "recommendations" | Placeholder<...>; ... 8 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }[]'.
      Object literal may only specify known properties, and 'id' does not exist in type '{ questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisType: SQL<unknown> | "thematic" | "clusters" | "contradictions" | "insights" | "recommendations" | Placeholder<...>; ... 8 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }[]'.

298             id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/llm-worker.ts:322:13 - error TS2769: No overload matches this call.
  Overload 2 of 2, '(values: { questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisType: SQL<unknown> | "thematic" | "clusters" | "contradictions" | "insights" | "recommendations" | Placeholder<...>; ... 8 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }[]): PgInsertBase<...>', gave the following error.
    Argument of type '{ id: string; questionnaireId: string; analysisType: string; status: string; errorMessage: string; triggeredBy: number; completedAt: Date; }' is not assignable to parameter of type '{ questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisType: SQL<unknown> | "thematic" | "clusters" | "contradictions" | "insights" | "recommendations" | Placeholder<...>; ... 8 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }[]'.
      Object literal may only specify known properties, and 'id' does not exist in type '{ questionnaireId: string | SQL<unknown> | Placeholder<string, any>; analysisType: SQL<unknown> | "thematic" | "clusters" | "contradictions" | "insights" | "recommendations" | Placeholder<...>; ... 8 more ...; triggeredBy?: string | ... 1 more ... | Placeholder<...>; }[]'.

322             id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/llm-worker.ts:525:31 - error TS2339: Property 'id' does not exist on type '{ jobId: string; }'.

525       console.warn(`Job ${job.id} stalled`);
                                  ~~

src/services/llm-worker.ts:529:30 - error TS2339: Property 'id' does not exist on type '{ jobId: string; data: JobProgress; }'.

529       console.log(`Job ${job.id} progress: ${progress}%`);
                                 ~~

src/services/llm-worker.ts:615:5 - error TS2740: Type '{ [index: string]: number; }' is missing the following properties from type '{ waiting: number; active: number; completed: number; failed: number; delayed: number; paused: number; }': waiting, active, completed, failed, and 2 more.

615     return counts;
        ~~~~~~~~~~~~~~

src/services/llmAnalysisService.ts:8:34 - error TS2724: '"./anonymizationService"' has no exported member named 'anonymizationService'. Did you mean 'AnonymizationService'?

8 import { AnonymizedContribution, anonymizationService } from './anonymizationService';
                                   ~~~~~~~~~~~~~~~~~~~~

  src/services/anonymizationService.ts:16:14
    16 export class AnonymizationService {
                    ~~~~~~~~~~~~~~~~~~~~
    'AnonymizationService' is declared here.

src/services/offlineStorage.ts:439:9 - error TS2698: Spread types may only be created from object types.

439         ...stats,
            ~~~~~~~~

src/services/pdfTemplateParser.ts:154:27 - error TS2349: This expression is not callable.
  Type 'typeof import("/Users/arkadiuszfudali/Git/manus_wrkshp/workshopsAI_cms/node_modules/pdf-parse/dist/pdf-parse/cjs/index")' has no call signatures.

154     const pdfData = await pdfParse(pdfBuffer);
                              ~~~~~~~~

src/services/pdfTemplateParser.ts:237:9 - error TS18004: No value exists in scope for the shorthand property 'total_questions'. Either declare one or provide an initializer.

237         total_questions,
            ~~~~~~~~~~~~~~~

src/services/performance-monitoring-service.ts:188:9 - error TS2740: Type '{}' is missing the following properties from type '{ timestamp: Date; value: number; }[]': length, pop, push, concat, and 29 more.

188         return cached;
            ~~~~~~~~~~~~~~

src/services/questionnaireCrudService.ts:160:9 - error TS1117: An object literal cannot have multiple properties with the same name.

160         workshopId: workshops.id as any, // Alias conflict workaround
            ~~~~~~~~~~

src/services/questionnaireCrudService.ts:263:9 - error TS2322: Type 'unknown' is not assignable to type 'Record<string, string>'.
  Index signature for type 'string' is missing in type '{}'.

263         titleI18n: questionnaireData.workshopTitleI18n || {},
            ~~~~~~~~~

  src/services/questionnaireCrudService.ts:48:5
    48     titleI18n: Record<string, string>;
           ~~~~~~~~~
    The expected type comes from property 'titleI18n' which is declared here on type '{ id: string; slug: string; titleI18n: Record<string, string>; status: string; }'

src/services/questionnaireCrudService.ts:365:38 - error TS2322: Type '{ anonymous?: boolean; require_consent?: boolean; max_responses?: number; close_after_workshop?: boolean; show_all_questions?: boolean; allow_edit?: boolean; question_style?: "first_person_plural" | "third_person"; }' is not assignable to type '{ anonymous: boolean; require_consent: boolean; max_responses: number; close_after_workshop: boolean; show_all_questions: boolean; allow_edit: boolean; question_style: "first_person_plural" | "third_person"; }'.
  Property 'anonymous' is optional in type '{ anonymous?: boolean; require_consent?: boolean; max_responses?: number; close_after_workshop?: boolean; show_all_questions?: boolean; allow_edit?: boolean; question_style?: "first_person_plural" | "third_person"; }' but required in type '{ anonymous: boolean; require_consent: boolean; max_responses: number; close_after_workshop: boolean; show_all_questions: boolean; allow_edit: boolean; question_style: "first_person_plural" | "third_person"; }'.

365     if (data.settings !== undefined) updateData.settings = data.settings;
                                         ~~~~~~~~~~~~~~~~~~~

src/services/questionnaireCrudService.ts:605:7 - error TS2322: Type '{ creator: { id: string; name: string; email: string; }; workshop: { id: string; slug: string; titleI18n: unknown; }; questionGroupCount: number; questionCount: number; responseCount: number; id: string; workshopId: string; ... 14 more ...; workshopTitleI18n: unknown; }[]' is not assignable to type '({ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; } & { ...; })[]'.
  Type '{ creator: { id: string; name: string; email: string; }; workshop: { id: string; slug: string; titleI18n: unknown; }; questionGroupCount: number; questionCount: number; responseCount: number; id: string; workshopId: string; ... 14 more ...; workshopTitleI18n: unknown; }' is not assignable to type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; } & { ...; }'.
    Type '{ creator: { id: string; name: string; email: string; }; workshop: { id: string; slug: string; titleI18n: unknown; }; questionGroupCount: number; questionCount: number; responseCount: number; id: string; workshopId: string; ... 14 more ...; workshopTitleI18n: unknown; }' is not assignable to type '{ creator: { id: string; name: string; email: string; }; workshop?: { id: string; slug: string; titleI18n: Record<string, string>; }; questionGroupCount: number; questionCount: number; responseCount: number; }'.
      The types of 'workshop.titleI18n' are incompatible between these types.
        Type 'unknown' is not assignable to type 'Record<string, string>'.
          Index signature for type 'string' is missing in type '{}'.

605       questionnaires: formattedQuestionnaires,
          ~~~~~~~~~~~~~~

  src/services/questionnaireCrudService.ts:483:5
    483     questionnaires: Array<
            ~~~~~~~~~~~~~~
    The expected type comes from property 'questionnaires' which is declared here on type '{ questionnaires: ({ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; ... 5 more ...; createdBy: string; } & { ...; })[]; total: number; }'

src/services/questionnaireCrudService.ts:819:38 - error TS2322: Type '{ collapsed?: boolean; show_progress?: boolean; icon?: string; color?: string; }' is not assignable to type '{ collapsed: boolean; show_progress: boolean; icon: string; color: string; }'.
  Property 'collapsed' is optional in type '{ collapsed?: boolean; show_progress?: boolean; icon?: string; color?: string; }' but required in type '{ collapsed: boolean; show_progress: boolean; icon: string; color: string; }'.

819     if (data.uiConfig !== undefined) updateData.uiConfig = data.uiConfig;
                                         ~~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:345:7 - error TS2322: Type 'number' is not assignable to type 'string'.

345       createdBy: creatorId,
          ~~~~~~~~~

  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'createdBy' which is declared here on type '{ titleI18n: unknown; createdBy: string; id?: string; createdAt?: Date; updatedAt?: Date; status?: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt?: Date; workshopId?: string; instructionsI18n?: unknown; settings?: { ...; }; publishedAt?: Date; closedAt?: Date; }'

src/services/questionnaireService.ts:363:5 - error TS1016: A required parameter cannot follow an optional parameter.

363     creatorId: number,
        ~~~~~~~~~

src/services/questionnaireService.ts:376:9 - error TS2345: Argument of type '{ workshopId: string; title: { pl: string; en: string; }; instructions: { pl: string; en: string; }; settings: { anonymous: boolean; require_consent: boolean; max_responses: any; close_after_workshop: boolean; show_all_questions: boolean; allow_edit: boolean; question_style: "first_person_plural"; }; }' is not assignable to parameter of type 'Omit<{ titleI18n: unknown; createdBy: string; id?: string; createdAt?: Date; updatedAt?: Date; status?: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt?: Date; workshopId?: string; instructionsI18n?: unknown; settings?: { ...; }; publishedAt?: Date; closedAt?: Date; }, "id" | ... 1 more ... | "up...'.
  Object literal may only specify known properties, and 'title' does not exist in type 'Omit<{ titleI18n: unknown; createdBy: string; id?: string; createdAt?: Date; updatedAt?: Date; status?: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt?: Date; workshopId?: string; instructionsI18n?: unknown; settings?: { ...; }; publishedAt?: Date; closedAt?: Date; }, "id" | ... 1 more ... | "up...'.

376         title: title || template.title,
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:390:9 - error TS2322: Type 'number' is not assignable to type 'string'.

390         orderIndex: groupData.order,
            ~~~~~~~~~~

  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'orderIndex' which is declared here on type '{ questionnaireId: string; titleI18n: unknown; orderIndex: string; id?: string; createdAt?: Date; updatedAt?: Date; descriptionI18n?: unknown; uiConfig?: { collapsed: boolean; show_progress: boolean; icon: string; color: string; }; }'

src/services/questionnaireService.ts:391:9 - error TS2741: Property 'color' is missing in type '{ collapsed: false; show_progress: true; icon: null; }' but required in type '{ collapsed: boolean; show_progress: boolean; icon: string; color: string; }'.

391         uiConfig: {
            ~~~~~~~~

  src/models/postgresql-schema.ts:804:9
    804         color: string | null;
                ~~~~~
    'color' is declared here.
  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'uiConfig' which is declared here on type '{ questionnaireId: string; titleI18n: unknown; orderIndex: string; id?: string; createdAt?: Date; updatedAt?: Date; descriptionI18n?: unknown; uiConfig?: { collapsed: boolean; show_progress: boolean; icon: string; color: string; }; }'

src/services/questionnaireService.ts:414:11 - error TS2322: Type 'number' is not assignable to type 'string'.

414           orderIndex: questionData.order,
              ~~~~~~~~~~

  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'orderIndex' which is declared here on type '{ orderIndex: string; type: "number" | "text" | "textarea" | "scale" | "single_choice" | "multiple_choice"; groupId: string; textI18n: unknown; id?: string; createdAt?: Date; updatedAt?: Date; optionsI18n?: { ...; }[]; validation?: { ...; }; conditionalLogic?: { ...; }; helpTextI18n?: { ...; }; }'

src/services/questionnaireService.ts:442:11 - error TS2322: Type '{ creator: { columns: { id: true; name: true; email: true; }; }; questionGroups: { orderBy: SQL<unknown>[]; with: { questions: { orderBy: SQL<unknown>[]; }; }; }; workshop: { columns: { id: true; title: true; slug: true; }; }; } | { ...; }' is not assignable to type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.
  Type '{ creator: { columns: { id: true; name: true; email: true; }; }; questionGroups: { orderBy: SQL<unknown>[]; with: { questions: { orderBy: SQL<unknown>[]; }; }; }; workshop: { columns: { id: true; title: true; slug: true; }; }; }' is not assignable to type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.
    Object literal may only specify known properties, and 'questionGroups' does not exist in type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.

442           questionGroups: {
              ~~~~~~~~~~~~~~~~~
443             orderBy: [asc(questionGroups.orderIndex)],
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
... 
448             },
    ~~~~~~~~~~~~~~
449           },
    ~~~~~~~~~~~

  node_modules/drizzle-orm/relations.d.ts:106:5
    106     with?: {
            ~~~~
    The expected type comes from property 'with' which is declared here on type 'KnownKeysOnly<Omit<DBQueryConfig<"many", true, ExtractTablesWithRelations<{ documentTypeEnum: PgEnum<["questionnaire_response", "question", "workshop_content", "analysis_result", "user_profile", "feedback", "announcement", "template", "module"]>; ... 121 more ...; workshopAnalysisResultsRelations: Relations<...>; }>...'

src/services/questionnaireService.ts:476:5 - error TS2740: Type '{ [x: string]: unknown; workshop: { [x: string]: unknown; feedback: { [x: string]: unknown; participant: { [x: string]: unknown; feedback: ...[]; consents: { [x: string]: unknown; user: ...; questionnaire: { [x: string]: unknown; workshop: ...; consents: ...[]; ... 4 more ...; jobs: { ...; }[]; }; }[]; ... 8 more .....' is missing the following properties from type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }': id, createdAt, updatedAt, status, and 8 more.

476     return questionnaire || null;
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:500:13 - error TS2322: Type '{ id: true; title: true; slug: true; }' is not assignable to type '{ id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; endDate?: boolean; seatLimit?: boolean; ... 16 more ...; deletedAt?: boolean; }'.
  Object literal may only specify known properties, and 'title' does not exist in type '{ id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; endDate?: boolean; seatLimit?: boolean; ... 16 more ...; deletedAt?: boolean; }'.

500             title: true,
                ~~~~~~~~~~~

src/services/questionnaireService.ts:507:5 - error TS2322: Type '{ [x: string]: unknown; workshop: { [x: string]: unknown; feedback: { [x: string]: unknown; participant: { [x: string]: unknown; feedback: ...[]; consents: { [x: string]: unknown; user: ...; questionnaire: { [x: string]: unknown; workshop: ...; consents: ...[]; ... 4 more ...; jobs: { ...; }[]; }; }[]; ... 8 more .....' is not assignable to type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }'.

507     return questionnaire || null;
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:541:28 - error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "createdBy"; tableName: "questionnaires"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: string | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number>, right: number | SQLWrapper): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "createdBy"; tableName: "questionnaires"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number>'.
      Type 'PgColumn<{ name: "createdBy"; tableName: "questionnaires"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "createdBy"; tableName: "questionnaires"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.

541       whereConditions.push(eq(questionnaires.createdBy, createdBy));
                               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/questionnaireService.ts:547:41 - error TS2339: Property 'title' does not exist on type 'PgTableWithColumns<{ name: "questionnaires"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "questionnaires"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 10 more ...; deletedAt: PgColumn<...>; }...'.

547           JSON_EXTRACT(${questionnaires.title}, '$.pl') LIKE ${`%${search}%`} OR
                                            ~~~~~

src/services/questionnaireService.ts:548:41 - error TS2339: Property 'title' does not exist on type 'PgTableWithColumns<{ name: "questionnaires"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "questionnaires"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; ... 7 more ...; generated: undefined; }, {}, {}>; ... 10 more ...; deletedAt: PgColumn<...>; }...'.

548           JSON_EXTRACT(${questionnaires.title}, '$.en') LIKE ${`%${search}%`}
                                            ~~~~~

src/services/questionnaireService.ts:572:15 - error TS2322: Type '{ id: true; title: true; slug: true; }' is not assignable to type '{ id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; endDate?: boolean; seatLimit?: boolean; ... 16 more ...; deletedAt?: boolean; }'.
  Object literal may only specify known properties, and 'title' does not exist in type '{ id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; endDate?: boolean; seatLimit?: boolean; ... 16 more ...; deletedAt?: boolean; }'.

572               title: true,
                  ~~~~~~~~~~~

src/services/questionnaireService.ts:626:9 - error TS2367: This comparison appears to be unintentional because the types 'string' and 'number' have no overlap.

626     if (questionnaire.createdBy !== userId) {
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:683:9 - error TS2367: This comparison appears to be unintentional because the types 'string' and 'number' have no overlap.

683     if (questionnaire.createdBy !== userId) {
            ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:691:9 - error TS2322: Type '"archived"' is not assignable to type 'SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | "draft" | "published" | "review" | "closed" | "analyzed"'.

691         status: 'archived',
            ~~~~~~

  node_modules/drizzle-orm/pg-core/query-builders/update.d.ts:28:57
    28 export type PgUpdateSetSource<TTable extends PgTable> = {
                                                               ~
    29     [Key in keyof TTable['$inferInsert']]?: GetColumnData<TTable['_']['columns'][Key]> | SQL | PgColumn | undefined;
       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    30 } & {};
       ~
    The expected type comes from property 'status' which is declared here on type '{ titleI18n?: unknown; createdBy?: string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}>; id?: string | SQL<unknown> | PgColumn<...>; ... 8 more ...; closedAt?: SQL<...> | ... 1 more ... | Date; }'

src/services/questionnaireService.ts:764:5 - error TS1016: A required parameter cannot follow an optional parameter.

764     creatorId: number,
        ~~~~~~~~~

src/services/questionnaireService.ts:776:9 - error TS2345: Argument of type '{ workshopId: string; title: { pl: string; en: string; }; instructions: any; status: "draft"; settings: { anonymous: boolean; require_consent: boolean; max_responses: number; close_after_workshop: boolean; show_all_questions: boolean; allow_edit: boolean; question_style: "first_person_plural" | "third_person"; }; }' is not assignable to parameter of type 'Omit<{ titleI18n: unknown; createdBy: string; id?: string; createdAt?: Date; updatedAt?: Date; status?: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt?: Date; workshopId?: string; instructionsI18n?: unknown; settings?: { ...; }; publishedAt?: Date; closedAt?: Date; }, "id" | ... 1 more ... | "up...'.
  Object literal may only specify known properties, and 'title' does not exist in type 'Omit<{ titleI18n: unknown; createdBy: string; id?: string; createdAt?: Date; updatedAt?: Date; status?: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt?: Date; workshopId?: string; instructionsI18n?: unknown; settings?: { ...; }; publishedAt?: Date; closedAt?: Date; }, "id" | ... 1 more ... | "up...'.

776         title: newTitle || {
            ~~~~~~~~~~~~~~~~~~~~
777           pl: `${original.title.pl} (kopia)`,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
778           en: `${original.title.en} (copy)`,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
779         },
    ~~~~~~~~~

src/services/questionnaireService.ts:777:27 - error TS2339: Property 'title' does not exist on type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }'.

777           pl: `${original.title.pl} (kopia)`,
                              ~~~~~

src/services/questionnaireService.ts:778:27 - error TS2339: Property 'title' does not exist on type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }'.

778           en: `${original.title.en} (copy)`,
                              ~~~~~

src/services/questionnaireService.ts:780:32 - error TS2551: Property 'instructions' does not exist on type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }'. Did you mean 'instructionsI18n'?

780         instructions: original.instructions,
                                   ~~~~~~~~~~~~

src/services/questionnaireService.ts:788:34 - error TS2339: Property 'questionGroups' does not exist on type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }'.

788     for (const group of original.questionGroups || []) {
                                     ~~~~~~~~~~~~~~

src/services/questionnaireService.ts:792:9 - error TS2322: Type '{ id: string; questionnaireId: string; title: any; description: any; orderIndex: any; uiConfig: any; }' is not assignable to type '{ questionnaireId: string; titleI18n: unknown; orderIndex: string; id?: string; createdAt?: Date; updatedAt?: Date; descriptionI18n?: unknown; uiConfig?: { collapsed: boolean; show_progress: boolean; icon: string; color: string; }; }'.
  Object literal may only specify known properties, and 'title' does not exist in type '{ questionnaireId: string; titleI18n: unknown; orderIndex: string; id?: string; createdAt?: Date; updatedAt?: Date; descriptionI18n?: unknown; uiConfig?: { collapsed: boolean; show_progress: boolean; icon: string; color: string; }; }'.

792         title: group.title,
            ~~~~~~~~~~~~~~~~~~

src/services/questionnaireService.ts:812:11 - error TS2322: Type '{ id: string; groupId: string; text: any; type: any; options: any; validation: any; conditionalLogic: any; orderIndex: any; helpText: any; }' is not assignable to type '{ orderIndex: string; type: "number" | "text" | "textarea" | "scale" | "single_choice" | "multiple_choice"; groupId: string; textI18n: unknown; id?: string; createdAt?: Date; updatedAt?: Date; optionsI18n?: { ...; }[]; validation?: { ...; }; conditionalLogic?: { ...; }; helpTextI18n?: { ...; }; }'.
  Object literal may only specify known properties, and 'text' does not exist in type '{ orderIndex: string; type: "number" | "text" | "textarea" | "scale" | "single_choice" | "multiple_choice"; groupId: string; textI18n: unknown; id?: string; createdAt?: Date; updatedAt?: Date; optionsI18n?: { ...; }[]; validation?: { ...; }; conditionalLogic?: { ...; }; helpTextI18n?: { ...; }; }'.

812           text: question.text,
              ~~~~~~~~~~~~~~~~~~~

src/services/responseService.ts:51:13 - error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: string | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number>, right: number | SQLWrapper): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number>'.
      Type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.

51           ? eq(responses.userId, data.userId)
               ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/responseService.ts:71:7 - error TS2322: Type 'number' is not assignable to type 'string'.

71       userId: data.userId,
         ~~~~~~

  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'userId' which is declared here on type '{ questionnaireId: string; questionId: string; answer: unknown; id?: string; metadata?: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt?: Date; updatedAt?: Date; userId?: string; status?: "draft" | "submitted"; enrollmentId?: string; submittedAt?: Date; }'

src/services/responseService.ts:133:20 - error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: string | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number>, right: number | SQLWrapper): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number>'.
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.

133           userId ? eq(responses.userId, userId) : isNull(responses.userId),
                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/responseService.ts:143:29 - error TS2339: Property 'affectedRows' does not exist on type 'never'.

143       submitted: result[0]?.affectedRows || 0,
                                ~~~~~~~~~~~~

src/services/responseService.ts:169:9 - error TS2322: Type '{ questionGroups: { with: { questions: { orderBy: (questions: any, { asc }: { asc: any; }) => any[]; }; }; }; }' is not assignable to type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.
  Object literal may only specify known properties, and 'questionGroups' does not exist in type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.

169         questionGroups: {
            ~~~~~~~~~~~~~~~~~
170           with: {
    ~~~~~~~~~~~~~~~~~
... 
174           },
    ~~~~~~~~~~~~
175         },
    ~~~~~~~~~

  node_modules/drizzle-orm/relations.d.ts:106:5
    106     with?: {
            ~~~~
    The expected type comes from property 'with' which is declared here on type 'KnownKeysOnly<Omit<DBQueryConfig<"many", true, ExtractTablesWithRelations<{ documentTypeEnum: PgEnum<["questionnaire_response", "question", "workshop_content", "analysis_result", "user_profile", "feedback", "announcement", "template", "module"]>; ... 121 more ...; workshopAnalysisResultsRelations: Relations<...>; }>...'

src/services/responseService.ts:185:21 - error TS2339: Property 'questionGroups' does not exist on type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; workshopId: string; settings: { anonymous: boolean; requireConsent: boolean; ... 4 more ...; questionStyle: "first_person_plural" | "third_person"; }; ... 5 more ...; instructions: unknown; }'.

185       questionnaire.questionGroups?.flatMap(g => g.questions || []) || [];
                        ~~~~~~~~~~~~~~

src/services/responseService.ts:194:18 - error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: string | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number>, right: number | SQLWrapper): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number>'.
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "responses"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: false; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.

194         userId ? eq(responses.userId, userId) : isNull(responses.userId),
                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/responseService.ts:208:14 - error TS2339: Property 'status' does not exist on type '{ id: string; metadata: { ipHash: string; userAgentHash: string; timeSpentMs: number; editCount: number; }; updatedAt: Date; userId: string; questionnaireId: string; questionId: string; enrollmentId: string; answer: unknown; submittedAt: Date; question: { ...; }; }'.

208       r => r.status === 'submitted',
                 ~~~~~~

src/services/responseService.ts:216:7 - error TS2322: Type '{ id: string; metadata: { ipHash: string; userAgentHash: string; timeSpentMs: number; editCount: number; }; updatedAt: Date; userId: string; questionnaireId: string; questionId: string; enrollmentId: string; answer: unknown; submittedAt: Date; question: { ...; }; }[]' is not assignable to type '{ id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }[]'.
  Type '{ id: string; metadata: { ipHash: string; userAgentHash: string; timeSpentMs: number; editCount: number; }; updatedAt: Date; userId: string; questionnaireId: string; questionId: string; enrollmentId: string; answer: unknown; submittedAt: Date; question: { ...; }; }' is missing the following properties from type '{ id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }': createdAt, status

216       responses: userResponses,
          ~~~~~~~~~

  src/services/responseService.ts:156:5
    156     responses: Response[];
            ~~~~~~~~~
    The expected type comes from property 'responses' which is declared here on type '{ responses: { id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }[]; questionnaire: { ...; }; completionStatus: { ...; }; }'

src/services/responseService.ts:217:7 - error TS2739: Type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; workshopId: string; settings: { anonymous: boolean; requireConsent: boolean; ... 4 more ...; questionStyle: "first_person_plural" | "third_person"; }; ... 5 more ...; instructions: unknown; }' is missing the following properties from type '{ id: string; createdAt: Date; updatedAt: Date; status: "draft" | "published" | "review" | "closed" | "analyzed"; deletedAt: Date; workshopId: string; titleI18n: unknown; instructionsI18n: unknown; settings: { ...; }; publishedAt: Date; closedAt: Date; createdBy: string; }': deletedAt, titleI18n, instructionsI18n

217       questionnaire,
          ~~~~~~~~~~~~~

  src/services/responseService.ts:157:5
    157     questionnaire: Questionnaire;
            ~~~~~~~~~~~~~
    The expected type comes from property 'questionnaire' which is declared here on type '{ responses: { id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }[]; questionnaire: { ...; }; completionStatus: { ...; }; }'

src/services/responseService.ts:247:7 - error TS2322: Type 'number' is not assignable to type 'string'.

247       userId: data.userId,
          ~~~~~~

  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'userId' which is declared here on type '{ userId: string; consentType: string; granted: boolean; id?: string; createdAt?: Date; updatedAt?: Date; userAgent?: string; ipAddress?: string; questionnaireId?: string; }'

src/services/responseService.ts:272:18 - error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: string | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number>, right: number | SQLWrapper): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number>'.
      Type 'PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is missing the following properties from type 'Aliased<number>': sql, fieldAlias
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.

272         userId ? eq(consents.userId, userId) : isNull(consents.userId),
                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/responseService.ts:273:25 - error TS2339: Property 'withdrawnAt' does not exist on type 'PgTableWithColumns<{ name: "consents"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 7 more ...; updatedAt: PgColumn<.....'.

273         isNull(consents.withdrawnAt),
                            ~~~~~~~~~~~

src/services/responseService.ts:277:5 - error TS2739: Type '{ id: string; userId: string; userAgent: string; ipAddress: string; questionnaireId: string; consentType: "research_analysis" | "marketing_emails" | "data_sharing" | "anonymous_presentation"; ... 4 more ...; revokedAt: Date; }' is missing the following properties from type '{ id: string; createdAt: Date; updatedAt: Date; userId: string; userAgent: string; ipAddress: string; questionnaireId: string; consentType: string; granted: boolean; }': createdAt, updatedAt

277     return consent || null;
        ~~~~~~~~~~~~~~~~~~~~~~~

src/services/responseService.ts:287:9 - error TS2345: Argument of type '{ withdrawnAt: Date; }' is not assignable to parameter of type '{ userId?: string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}>; consentType?: string | SQL<unknown> | PgColumn<...>; ... 6 more ...; questionnaireId?: string | ... 1 more ... | PgColumn<...>; }'.
  Object literal may only specify known properties, and 'withdrawnAt' does not exist in type '{ userId?: string | SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}>; consentType?: string | SQL<unknown> | PgColumn<...>; ... 6 more ...; questionnaireId?: string | ... 1 more ... | PgColumn<...>; }'.

287         withdrawnAt: new Date(),
            ~~~~~~~~~~~~~~~~~~~~~~~

src/services/responseService.ts:292:20 - error TS2769: No overload matches this call.
  Overload 1 of 3, '(left: PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>, right: string | SQLWrapper): SQL<...>', gave the following error.
    Argument of type 'number' is not assignable to parameter of type 'string | SQLWrapper'.
  Overload 2 of 3, '(left: Aliased<number>, right: number | SQLWrapper): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'Aliased<number>'.
  Overload 3 of 3, '(left: never, right: unknown): SQL<unknown>', gave the following error.
    Argument of type 'PgColumn<{ name: "userId"; tableName: "consents"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: false; isPrimaryKey: false; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>' is not assignable to parameter of type 'never'.

292           userId ? eq(consents.userId, userId) : sql`1=1`,
                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/responseService.ts:296:24 - error TS2339: Property 'affectedRows' does not exist on type 'never'.

296     return (result[0]?.affectedRows || 0) > 0;
                           ~~~~~~~~~~~~

src/services/responseService.ts:348:30 - error TS2339: Property 'text' does not exist on type '{ id: string; groupId: string; textI18n: unknown; type: "number" | "text" | "textarea" | "scale" | "single_choice" | "multiple_choice"; optionsI18n: { value: string; label: { pl: string; en: string; }; }[]; ... 5 more ...; updatedAt: Date; }'.

348       questionText: question.text,
                                 ~~~~

src/services/responseService.ts:386:8 - error TS2349: This expression is not callable.
  Type 'never' has no call signatures.

386       .innerJoin(sql`questionGroups qg`, sql`q.groupId = qg.id`)
           ~~~~~~~~~

src/services/responseService.ts:393:33 - error TS2339: Property 'text' does not exist on type 'PgTableWithColumns<{ name: "questions"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "questions"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 9 more ...; updatedAt: PgColumn<...'.

393         questionText: questions.text,
                                    ~~~~

src/services/responseService.ts:416:40 - error TS2339: Property 'text' does not exist on type 'PgTableWithColumns<{ name: "questions"; schema: undefined; columns: { id: PgColumn<{ name: "id"; tableName: "questions"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: true; ... 6 more ...; generated: undefined; }, {}, {}>; ... 9 more ...; updatedAt: PgColumn<...'.

416       .groupBy(questions.id, questions.text, questions.type)
                                           ~~~~

src/services/responseService.ts:417:16 - error TS2769: No overload matches this call.
  Overload 1 of 2, '(builder: (aliases: { questionId: PgColumn<{ name: "id"; tableName: "questions"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>; ... 4 more ...; skipRate: SQL<...>; }) => ValueOrArray<...>): Omit<...>', gave the following error.
    Argument of type '(responses: any, { asc }: { asc: any; }) => any[]' is not assignable to parameter of type '(aliases: { questionId: PgColumn<{ name: "id"; tableName: "questions"; dataType: "string"; columnType: "PgUUID"; data: string; driverParam: string; notNull: true; hasDefault: true; isPrimaryKey: true; isAutoincrement: false; ... 4 more ...; generated: undefined; }, {}, {}>; ... 4 more ...; skipRate: SQL<...>; }) => ...'.
  Overload 2 of 2, '(...columns: (SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | Aliased<unknown>)[]): Omit<PgSelectBase<"responses", ... 6 more ..., { ...; }>, "where" | ... 1 more ... | "groupBy">', gave the following error.
    Argument of type '(responses: any, { asc }: { asc: any; }) => any[]' is not assignable to parameter of type 'SQL<unknown> | PgColumn<ColumnBaseConfig<ColumnDataType, string>, {}, {}> | Aliased<unknown>'.

417       .orderBy((responses, { asc }) => [asc(questions.orderIndex)]);
                   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~


src/services/responseService.ts:460:22 - error TS2551: Property 'question' does not exist on type '{ id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }'. Did you mean 'questionId'?

460         `"${response.question?.text?.pl || ''}"`,
                         ~~~~~~~~

src/services/responseService.ts:461:22 - error TS2551: Property 'question' does not exist on type '{ id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }'. Did you mean 'questionId'?

461         `"${response.question?.text?.en || ''}"`,
                         ~~~~~~~~

src/services/responseService.ts:462:18 - error TS2551: Property 'question' does not exist on type '{ id: string; metadata: { ip_hash: string; user_agent_hash: string; time_spent_ms: number; edit_count: number; }; createdAt: Date; updatedAt: Date; userId: string; status: "draft" | "submitted"; ... 4 more ...; submittedAt: Date; }'. Did you mean 'questionId'?

462         response.question?.type || '',
                     ~~~~~~~~

src/services/security-monitoring.ts:713:19 - error TS2341: Property 'implementBlockingResponse' is private and only accessible within class 'SecurityMonitoringService'.

713   securityMonitor.implementBlockingResponse(ip);
                      ~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/security-monitoring.ts:722:3 - error TS2484: Export declaration conflicts with exported declaration of 'SecurityEventType'.

722   SecurityEventType,
      ~~~~~~~~~~~~~~~~~

src/services/security-monitoring.ts:723:3 - error TS2484: Export declaration conflicts with exported declaration of 'SecuritySeverity'.

723   SecuritySeverity,
      ~~~~~~~~~~~~~~~~

src/services/streaming-llm-worker.ts:85:23 - error TS2769: No overload matches this call.
  Overload 1 of 8, '(options: RedisOptions): Redis', gave the following error.
    Argument of type '{ host: string; port: number; password: string; db: number; maxRetriesPerRequest: null; lazyConnect: true; enableOfflineQueue: false; maxMemoryPolicy: string; }' is not assignable to parameter of type 'RedisOptions'.
      Object literal may only specify known properties, and 'maxMemoryPolicy' does not exist in type 'RedisOptions'.
  Overload 2 of 8, '(port: number): Redis', gave the following error.
    Argument of type '{ host: string; port: number; password: string; db: number; maxRetriesPerRequest: null; lazyConnect: boolean; enableOfflineQueue: boolean; maxMemoryPolicy: string; }' is not assignable to parameter of type 'number'.
  Overload 3 of 8, '(path: string): Redis', gave the following error.
    Argument of type '{ host: string; port: number; password: string; db: number; maxRetriesPerRequest: null; lazyConnect: boolean; enableOfflineQueue: boolean; maxMemoryPolicy: string; }' is not assignable to parameter of type 'string'.

 85     this.connection = new Redis({
                          ~~~~~~~~~~~
 86       host: process.env.REDIS_HOST || 'localhost',
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
... 
 93       maxMemoryPolicy: 'allkeys-lru',
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 94     });
    ~~~~~~


src/services/streaming-llm-worker.ts:417:9 - error TS2552: Cannot find name 'questionnaireId'. Did you mean 'questionnaire'?

417         questionnaireId,
            ~~~~~~~~~~~~~~~

  src/services/streaming-llm-worker.ts:291:5
    291     questionnaire: any,
            ~~~~~~~~~~~~~~~~~~
    'questionnaire' is declared here.

src/services/streaming-llm-worker.ts:488:9 - error TS2322: Type '{ questionGroups: { with: { questions: { with: { responses: { limit: number; }; }; }; }; }; }' is not assignable to type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.
  Object literal may only specify known properties, and 'questionGroups' does not exist in type '{ workshop?: true | { columns?: { id?: boolean; slug?: boolean; titleI18n?: boolean; subtitleI18n?: boolean; descriptionI18n?: boolean; shortDescriptionI18n?: boolean; status?: boolean; startDate?: boolean; ... 18 more ...; deletedAt?: boolean; }; with?: { ...; }; extras?: Record<...> | ((fields: { ...; }, operators...'.

488         questionGroups: {
            ~~~~~~~~~~~~~~~~~
489           with: {
    ~~~~~~~~~~~~~~~~~
... 
497           },
    ~~~~~~~~~~~~
498         },
    ~~~~~~~~~

  node_modules/drizzle-orm/relations.d.ts:106:5
    106     with?: {
            ~~~~
    The expected type comes from property 'with' which is declared here on type 'KnownKeysOnly<Omit<DBQueryConfig<"many", true, ExtractTablesWithRelations<{ documentTypeEnum: PgEnum<["questionnaire_response", "question", "workshop_content", "analysis_result", "user_profile", "feedback", "announcement", "template", "module"]>; ... 121 more ...; workshopAnalysisResultsRelations: Relations<...>; }>...'

src/services/streaming-llm-worker.ts:506:47 - error TS2339: Property 'flatMap' does not exist on type 'unknown'.

506       responses: questionnaire.questionGroups.flatMap((qg: any) =>
                                                  ~~~~~~~

src/services/streaming-llm-worker.ts:906:36 - error TS2345: Argument of type '(job: {    id?: string;}) => void' is not assignable to parameter of type '(args: { jobId: string; }, id: string) => void'.
  Types of parameters 'job' and 'args' are incompatible.
    Type '{ jobId: string; }' has no properties in common with type '{ id?: string; }'.

906     this.queueEvents.on('stalled', (job: { id?: string }) => {
                                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/services/templateManager.ts:156:11 - error TS2322: Type '{ value: string; label: { pl: string; en?: string; }; }[]' is not assignable to type '{ value: string; label: { pl: string; en: string; }; }[]'.
  Type '{ value: string; label: { pl: string; en?: string; }; }' is not assignable to type '{ value: string; label: { pl: string; en: string; }; }'.
    Types of property 'label' are incompatible.
      Type '{ pl: string; en?: string; }' is not assignable to type '{ pl: string; en: string; }'.
        Property 'en' is optional in type '{ pl: string; en?: string; }' but required in type '{ pl: string; en: string; }'.

156           optionsI18n: questionData.options,
              ~~~~~~~~~~~

  node_modules/drizzle-orm/utils.d.ts:12:27
    12 export type Simplify<T> = {
                                 ~
    13     [K in keyof T]: T[K];
       ~~~~~~~~~~~~~~~~~~~~~~~~~
    14 } & {};
       ~
    The expected type comes from property 'optionsI18n' which is declared here on type '{ orderIndex: string; type: "number" | "text" | "textarea" | "scale" | "single_choice" | "multiple_choice"; groupId: string; textI18n: unknown; id?: string; createdAt?: Date; updatedAt?: Date; optionsI18n?: { ...; }[]; validation?: { ...; }; conditionalLogic?: { ...; }; helpTextI18n?: { ...; }; }'

src/services/templateManager.ts:161:42 - error TS2339: Property 'conditionalLogic' does not exist on type 'ParsedQuestion'.

161           conditionalLogic: questionData.conditionalLogic || undefined,
                                             ~~~~~~~~~~~~~~~~

src/services/vector/embeddingService.ts:615:34 - error TS2339: Property 'usage' does not exist on type 'unknown'.

615     const totalTokens = response.usage?.total_tokens || 0;
                                     ~~~~~

src/services/vector/embeddingService.ts:618:21 - error TS2339: Property 'data' does not exist on type 'unknown'.

618     return response.data.map((embedding, index) => ({
                        ~~~~

src/services/vector/index.ts:73:11 - error TS2304: Cannot find name 'vectorDatabaseManager'.

73     await vectorDatabaseManager.initialize();
             ~~~~~~~~~~~~~~~~~~~~~

src/services/vector/index.ts:76:11 - error TS2304: Cannot find name 'vectorIndexManager'.

76     await vectorIndexManager.initialize();
             ~~~~~~~~~~~~~~~~~~

src/services/vector/index.ts:80:7 - error TS2304: Cannot find name 'vectorDatabaseManager'.

80       vectorDatabaseManager.healthCheck(),
         ~~~~~~~~~~~~~~~~~~~~~

src/services/vector/index.ts:81:7 - error TS2304: Cannot find name 'embeddingService'.

81       embeddingService.healthCheck(),
         ~~~~~~~~~~~~~~~~

src/services/vector/index.ts:106:11 - error TS2304: Cannot find name 'vectorIndexManager'.

106     await vectorIndexManager.shutdown();
              ~~~~~~~~~~~~~~~~~~

src/services/vector/index.ts:107:11 - error TS2304: Cannot find name 'vectorDatabaseManager'.

107     await vectorDatabaseManager.close();
              ~~~~~~~~~~~~~~~~~~~~~

src/services/vector/performanceMonitor.ts:581:5 - error TS2322: Type '{ query: unknown; timestamp: unknown; duration: unknown; results: unknown; }[]' is not assignable to type '{ query: string; timestamp: Date; duration: number; results: number; }[]'.
  Type '{ query: unknown; timestamp: unknown; duration: unknown; results: unknown; }' is not assignable to type '{ query: string; timestamp: Date; duration: number; results: number; }'.
    Types of property 'query' are incompatible.
      Type 'unknown' is not assignable to type 'string'.

581     return recent.map(item => ({
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~
582       query: item.query,
    ~~~~~~~~~~~~~~~~~~~~~~~~
... 
585       results: item.results || 0,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
586     }));
    ~~~~~~~~

src/services/vector/performanceMonitor.ts:607:5 - error TS2322: Type '{ query: unknown; count: number; avgTime: number; }[]' is not assignable to type '{ query: string; count: number; avgTime: number; }[]'.
  Type '{ query: unknown; count: number; avgTime: number; }' is not assignable to type '{ query: string; count: number; avgTime: number; }'.
    Types of property 'query' are incompatible.
      Type 'unknown' is not assignable to type 'string'.

607     return topQueries.map(item => ({
        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
608       query: item.query,
    ~~~~~~~~~~~~~~~~~~~~~~~~
... 
610       avgTime: item.avgTime || 0,
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
611     }));
    ~~~~~~~~

src/services/vector/ragQueryEngine.ts:351:29 - error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.

351     return await this.query(originalDoc.content, searchOptions);
                                ~~~~~~~~~~~~~~~~~~~

src/services/vector/ragQueryEngine.ts:443:21 - error TS2339: Property 'substring' does not exist on type 'unknown'.

443           row.query.substring(0, 50) + (row.query.length > 50 ? '...' : ''),
                        ~~~~~~~~~

src/services/vector/ragQueryEngine.ts:443:51 - error TS2339: Property 'length' does not exist on type 'unknown'.

443           row.query.substring(0, 50) + (row.query.length > 50 ? '...' : ''),
                                                      ~~~~~~


Found 307 errors in 43 files.

Errors  Files
     3  src/middleware/enhanced-performance-middleware.ts:66
     2  src/middleware/performanceMiddleware.ts:41
     3  src/models/bilingualSchema.ts:14
     5  src/models/vector-schema.ts:64
     4  src/queues/workshopAnalysisQueue.ts:9
    14  src/routes/api/analysis.ts:107
     3  src/routes/api/enhanced-performance.ts:98
     1  src/routes/api/files-signed.ts:25
     1  src/routes/api/performance.ts:101
    11  src/routes/api/questionnaires.ts:179
     7  src/routes/enrollments.ts:21
    11  src/routes/public.ts:125
    19  src/routes/responses.ts:16
     8  src/routes/templates.ts:5
    14  src/services/analysis-types.ts:70
    47  src/services/analysis-websocket.ts:15
     9  src/services/anonymization.ts:267
     1  src/services/anonymizationService.ts:70
     3  src/services/bilingualService.ts:8
     3  src/services/caching-service.ts:282
     1  src/services/database-migration.service.ts:4
     2  src/services/emailAnalyticsService.ts:1
     1  src/services/emailValidationService.ts:1
    16  src/services/embeddings.ts:244
     2  src/services/enhanced-caching-service.ts:382
     7  src/services/enhanced-performance-monitoring-service.ts:364
    15  src/services/enrollmentService.ts:8
     3  src/services/export-service.ts:85
     8  src/services/llm-worker.ts:103
     1  src/services/llmAnalysisService.ts:8
     1  src/services/offlineStorage.ts:439
     2  src/services/pdfTemplateParser.ts:154
     1  src/services/performance-monitoring-service.ts:188
     5  src/services/questionnaireCrudService.ts:160
    25  src/services/questionnaireService.ts:345
    25  src/services/responseService.ts:51
     3  src/services/security-monitoring.ts:713
     5  src/services/streaming-llm-worker.ts:85
     2  src/services/templateManager.ts:156
     2  src/services/vector/embeddingService.ts:615
     6  src/services/vector/index.ts:73
     2  src/services/vector/performanceMonitor.ts:581
     3  src/services/vector/ragQueryEngine.ts:351
arkadiuszfudali@Mac workshopsAI_cms % 