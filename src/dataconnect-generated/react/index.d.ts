import { CreateWorkshopData, CreateWorkshopVariables, ListWorkshopsData, UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables, GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateWorkshop(options?: useDataConnectMutationOptions<CreateWorkshopData, FirebaseError, CreateWorkshopVariables>): UseDataConnectMutationResult<CreateWorkshopData, CreateWorkshopVariables>;
export function useCreateWorkshop(dc: DataConnect, options?: useDataConnectMutationOptions<CreateWorkshopData, FirebaseError, CreateWorkshopVariables>): UseDataConnectMutationResult<CreateWorkshopData, CreateWorkshopVariables>;

export function useListWorkshops(options?: useDataConnectQueryOptions<ListWorkshopsData>): UseDataConnectQueryResult<ListWorkshopsData, undefined>;
export function useListWorkshops(dc: DataConnect, options?: useDataConnectQueryOptions<ListWorkshopsData>): UseDataConnectQueryResult<ListWorkshopsData, undefined>;

export function useUpdateSessionIsRegistrationOpen(options?: useDataConnectMutationOptions<UpdateSessionIsRegistrationOpenData, FirebaseError, UpdateSessionIsRegistrationOpenVariables>): UseDataConnectMutationResult<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;
export function useUpdateSessionIsRegistrationOpen(dc: DataConnect, options?: useDataConnectMutationOptions<UpdateSessionIsRegistrationOpenData, FirebaseError, UpdateSessionIsRegistrationOpenVariables>): UseDataConnectMutationResult<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;

export function useGetSessionsByWorkshopId(vars: GetSessionsByWorkshopIdVariables, options?: useDataConnectQueryOptions<GetSessionsByWorkshopIdData>): UseDataConnectQueryResult<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
export function useGetSessionsByWorkshopId(dc: DataConnect, vars: GetSessionsByWorkshopIdVariables, options?: useDataConnectQueryOptions<GetSessionsByWorkshopIdData>): UseDataConnectQueryResult<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
