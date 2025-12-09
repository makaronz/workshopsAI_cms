import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface CreateWorkshopData {
  workshop_insert: Workshop_Key;
}

export interface CreateWorkshopVariables {
  organizerId: UUIDString;
  capacity: number;
  description: string;
  title: string;
}

export interface GetSessionsByWorkshopIdData {
  sessions: ({
    id: UUIDString;
    date: DateString;
    startTime: string;
    endTime: string;
    location: string;
    isRegistrationOpen: boolean;
  } & Session_Key)[];
}

export interface GetSessionsByWorkshopIdVariables {
  workshopId: UUIDString;
}

export interface Instructor_Key {
  id: UUIDString;
  __typename?: 'Instructor_Key';
}

export interface ListWorkshopsData {
  workshops: ({
    id: UUIDString;
    title: string;
    description: string;
  } & Workshop_Key)[];
}

export interface Organizer_Key {
  id: UUIDString;
  __typename?: 'Organizer_Key';
}

export interface Participant_Key {
  id: UUIDString;
  __typename?: 'Participant_Key';
}

export interface Registration_Key {
  id: UUIDString;
  __typename?: 'Registration_Key';
}

export interface Session_Key {
  id: UUIDString;
  __typename?: 'Session_Key';
}

export interface UpdateSessionIsRegistrationOpenData {
  session_update?: Session_Key | null;
}

export interface UpdateSessionIsRegistrationOpenVariables {
  id: UUIDString;
  isRegistrationOpen: boolean;
}

export interface Workshop_Key {
  id: UUIDString;
  __typename?: 'Workshop_Key';
}

interface CreateWorkshopRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWorkshopVariables): MutationRef<CreateWorkshopData, CreateWorkshopVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateWorkshopVariables): MutationRef<CreateWorkshopData, CreateWorkshopVariables>;
  operationName: string;
}
export const createWorkshopRef: CreateWorkshopRef;

export function createWorkshop(vars: CreateWorkshopVariables): MutationPromise<CreateWorkshopData, CreateWorkshopVariables>;
export function createWorkshop(dc: DataConnect, vars: CreateWorkshopVariables): MutationPromise<CreateWorkshopData, CreateWorkshopVariables>;

interface ListWorkshopsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListWorkshopsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<ListWorkshopsData, undefined>;
  operationName: string;
}
export const listWorkshopsRef: ListWorkshopsRef;

export function listWorkshops(): QueryPromise<ListWorkshopsData, undefined>;
export function listWorkshops(dc: DataConnect): QueryPromise<ListWorkshopsData, undefined>;

interface UpdateSessionIsRegistrationOpenRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSessionIsRegistrationOpenVariables): MutationRef<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpdateSessionIsRegistrationOpenVariables): MutationRef<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;
  operationName: string;
}
export const updateSessionIsRegistrationOpenRef: UpdateSessionIsRegistrationOpenRef;

export function updateSessionIsRegistrationOpen(vars: UpdateSessionIsRegistrationOpenVariables): MutationPromise<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;
export function updateSessionIsRegistrationOpen(dc: DataConnect, vars: UpdateSessionIsRegistrationOpenVariables): MutationPromise<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;

interface GetSessionsByWorkshopIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSessionsByWorkshopIdVariables): QueryRef<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetSessionsByWorkshopIdVariables): QueryRef<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
  operationName: string;
}
export const getSessionsByWorkshopIdRef: GetSessionsByWorkshopIdRef;

export function getSessionsByWorkshopId(vars: GetSessionsByWorkshopIdVariables): QueryPromise<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
export function getSessionsByWorkshopId(dc: DataConnect, vars: GetSessionsByWorkshopIdVariables): QueryPromise<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;

