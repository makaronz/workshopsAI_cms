# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*ListWorkshops*](#listworkshops)
  - [*GetSessionsByWorkshopId*](#getsessionsbyworkshopid)
- [**Mutations**](#mutations)
  - [*CreateWorkshop*](#createworkshop)
  - [*UpdateSessionIsRegistrationOpen*](#updatesessionisregistrationopen)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## ListWorkshops
You can execute the `ListWorkshops` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
listWorkshops(): QueryPromise<ListWorkshopsData, undefined>;

interface ListWorkshopsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<ListWorkshopsData, undefined>;
}
export const listWorkshopsRef: ListWorkshopsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
listWorkshops(dc: DataConnect): QueryPromise<ListWorkshopsData, undefined>;

interface ListWorkshopsRef {
  ...
  (dc: DataConnect): QueryRef<ListWorkshopsData, undefined>;
}
export const listWorkshopsRef: ListWorkshopsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the listWorkshopsRef:
```typescript
const name = listWorkshopsRef.operationName;
console.log(name);
```

### Variables
The `ListWorkshops` query has no variables.
### Return Type
Recall that executing the `ListWorkshops` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ListWorkshopsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ListWorkshopsData {
  workshops: ({
    id: UUIDString;
    title: string;
    description: string;
  } & Workshop_Key)[];
}
```
### Using `ListWorkshops`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, listWorkshops } from '@dataconnect/generated';


// Call the `listWorkshops()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await listWorkshops();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await listWorkshops(dataConnect);

console.log(data.workshops);

// Or, you can use the `Promise` API.
listWorkshops().then((response) => {
  const data = response.data;
  console.log(data.workshops);
});
```

### Using `ListWorkshops`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, listWorkshopsRef } from '@dataconnect/generated';


// Call the `listWorkshopsRef()` function to get a reference to the query.
const ref = listWorkshopsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = listWorkshopsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.workshops);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.workshops);
});
```

## GetSessionsByWorkshopId
You can execute the `GetSessionsByWorkshopId` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getSessionsByWorkshopId(vars: GetSessionsByWorkshopIdVariables): QueryPromise<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;

interface GetSessionsByWorkshopIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetSessionsByWorkshopIdVariables): QueryRef<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
}
export const getSessionsByWorkshopIdRef: GetSessionsByWorkshopIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSessionsByWorkshopId(dc: DataConnect, vars: GetSessionsByWorkshopIdVariables): QueryPromise<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;

interface GetSessionsByWorkshopIdRef {
  ...
  (dc: DataConnect, vars: GetSessionsByWorkshopIdVariables): QueryRef<GetSessionsByWorkshopIdData, GetSessionsByWorkshopIdVariables>;
}
export const getSessionsByWorkshopIdRef: GetSessionsByWorkshopIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSessionsByWorkshopIdRef:
```typescript
const name = getSessionsByWorkshopIdRef.operationName;
console.log(name);
```

### Variables
The `GetSessionsByWorkshopId` query requires an argument of type `GetSessionsByWorkshopIdVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetSessionsByWorkshopIdVariables {
  workshopId: UUIDString;
}
```
### Return Type
Recall that executing the `GetSessionsByWorkshopId` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSessionsByWorkshopIdData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetSessionsByWorkshopId`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSessionsByWorkshopId, GetSessionsByWorkshopIdVariables } from '@dataconnect/generated';

// The `GetSessionsByWorkshopId` query requires an argument of type `GetSessionsByWorkshopIdVariables`:
const getSessionsByWorkshopIdVars: GetSessionsByWorkshopIdVariables = {
  workshopId: ..., 
};

// Call the `getSessionsByWorkshopId()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSessionsByWorkshopId(getSessionsByWorkshopIdVars);
// Variables can be defined inline as well.
const { data } = await getSessionsByWorkshopId({ workshopId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSessionsByWorkshopId(dataConnect, getSessionsByWorkshopIdVars);

console.log(data.sessions);

// Or, you can use the `Promise` API.
getSessionsByWorkshopId(getSessionsByWorkshopIdVars).then((response) => {
  const data = response.data;
  console.log(data.sessions);
});
```

### Using `GetSessionsByWorkshopId`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSessionsByWorkshopIdRef, GetSessionsByWorkshopIdVariables } from '@dataconnect/generated';

// The `GetSessionsByWorkshopId` query requires an argument of type `GetSessionsByWorkshopIdVariables`:
const getSessionsByWorkshopIdVars: GetSessionsByWorkshopIdVariables = {
  workshopId: ..., 
};

// Call the `getSessionsByWorkshopIdRef()` function to get a reference to the query.
const ref = getSessionsByWorkshopIdRef(getSessionsByWorkshopIdVars);
// Variables can be defined inline as well.
const ref = getSessionsByWorkshopIdRef({ workshopId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSessionsByWorkshopIdRef(dataConnect, getSessionsByWorkshopIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.sessions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.sessions);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateWorkshop
You can execute the `CreateWorkshop` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createWorkshop(vars: CreateWorkshopVariables): MutationPromise<CreateWorkshopData, CreateWorkshopVariables>;

interface CreateWorkshopRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateWorkshopVariables): MutationRef<CreateWorkshopData, CreateWorkshopVariables>;
}
export const createWorkshopRef: CreateWorkshopRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createWorkshop(dc: DataConnect, vars: CreateWorkshopVariables): MutationPromise<CreateWorkshopData, CreateWorkshopVariables>;

interface CreateWorkshopRef {
  ...
  (dc: DataConnect, vars: CreateWorkshopVariables): MutationRef<CreateWorkshopData, CreateWorkshopVariables>;
}
export const createWorkshopRef: CreateWorkshopRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createWorkshopRef:
```typescript
const name = createWorkshopRef.operationName;
console.log(name);
```

### Variables
The `CreateWorkshop` mutation requires an argument of type `CreateWorkshopVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateWorkshopVariables {
  organizerId: UUIDString;
  capacity: number;
  description: string;
  title: string;
}
```
### Return Type
Recall that executing the `CreateWorkshop` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateWorkshopData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateWorkshopData {
  workshop_insert: Workshop_Key;
}
```
### Using `CreateWorkshop`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createWorkshop, CreateWorkshopVariables } from '@dataconnect/generated';

// The `CreateWorkshop` mutation requires an argument of type `CreateWorkshopVariables`:
const createWorkshopVars: CreateWorkshopVariables = {
  organizerId: ..., 
  capacity: ..., 
  description: ..., 
  title: ..., 
};

// Call the `createWorkshop()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createWorkshop(createWorkshopVars);
// Variables can be defined inline as well.
const { data } = await createWorkshop({ organizerId: ..., capacity: ..., description: ..., title: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createWorkshop(dataConnect, createWorkshopVars);

console.log(data.workshop_insert);

// Or, you can use the `Promise` API.
createWorkshop(createWorkshopVars).then((response) => {
  const data = response.data;
  console.log(data.workshop_insert);
});
```

### Using `CreateWorkshop`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createWorkshopRef, CreateWorkshopVariables } from '@dataconnect/generated';

// The `CreateWorkshop` mutation requires an argument of type `CreateWorkshopVariables`:
const createWorkshopVars: CreateWorkshopVariables = {
  organizerId: ..., 
  capacity: ..., 
  description: ..., 
  title: ..., 
};

// Call the `createWorkshopRef()` function to get a reference to the mutation.
const ref = createWorkshopRef(createWorkshopVars);
// Variables can be defined inline as well.
const ref = createWorkshopRef({ organizerId: ..., capacity: ..., description: ..., title: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createWorkshopRef(dataConnect, createWorkshopVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.workshop_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.workshop_insert);
});
```

## UpdateSessionIsRegistrationOpen
You can execute the `UpdateSessionIsRegistrationOpen` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
updateSessionIsRegistrationOpen(vars: UpdateSessionIsRegistrationOpenVariables): MutationPromise<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;

interface UpdateSessionIsRegistrationOpenRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpdateSessionIsRegistrationOpenVariables): MutationRef<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;
}
export const updateSessionIsRegistrationOpenRef: UpdateSessionIsRegistrationOpenRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
updateSessionIsRegistrationOpen(dc: DataConnect, vars: UpdateSessionIsRegistrationOpenVariables): MutationPromise<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;

interface UpdateSessionIsRegistrationOpenRef {
  ...
  (dc: DataConnect, vars: UpdateSessionIsRegistrationOpenVariables): MutationRef<UpdateSessionIsRegistrationOpenData, UpdateSessionIsRegistrationOpenVariables>;
}
export const updateSessionIsRegistrationOpenRef: UpdateSessionIsRegistrationOpenRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the updateSessionIsRegistrationOpenRef:
```typescript
const name = updateSessionIsRegistrationOpenRef.operationName;
console.log(name);
```

### Variables
The `UpdateSessionIsRegistrationOpen` mutation requires an argument of type `UpdateSessionIsRegistrationOpenVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpdateSessionIsRegistrationOpenVariables {
  id: UUIDString;
  isRegistrationOpen: boolean;
}
```
### Return Type
Recall that executing the `UpdateSessionIsRegistrationOpen` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpdateSessionIsRegistrationOpenData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpdateSessionIsRegistrationOpenData {
  session_update?: Session_Key | null;
}
```
### Using `UpdateSessionIsRegistrationOpen`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, updateSessionIsRegistrationOpen, UpdateSessionIsRegistrationOpenVariables } from '@dataconnect/generated';

// The `UpdateSessionIsRegistrationOpen` mutation requires an argument of type `UpdateSessionIsRegistrationOpenVariables`:
const updateSessionIsRegistrationOpenVars: UpdateSessionIsRegistrationOpenVariables = {
  id: ..., 
  isRegistrationOpen: ..., 
};

// Call the `updateSessionIsRegistrationOpen()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await updateSessionIsRegistrationOpen(updateSessionIsRegistrationOpenVars);
// Variables can be defined inline as well.
const { data } = await updateSessionIsRegistrationOpen({ id: ..., isRegistrationOpen: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await updateSessionIsRegistrationOpen(dataConnect, updateSessionIsRegistrationOpenVars);

console.log(data.session_update);

// Or, you can use the `Promise` API.
updateSessionIsRegistrationOpen(updateSessionIsRegistrationOpenVars).then((response) => {
  const data = response.data;
  console.log(data.session_update);
});
```

### Using `UpdateSessionIsRegistrationOpen`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, updateSessionIsRegistrationOpenRef, UpdateSessionIsRegistrationOpenVariables } from '@dataconnect/generated';

// The `UpdateSessionIsRegistrationOpen` mutation requires an argument of type `UpdateSessionIsRegistrationOpenVariables`:
const updateSessionIsRegistrationOpenVars: UpdateSessionIsRegistrationOpenVariables = {
  id: ..., 
  isRegistrationOpen: ..., 
};

// Call the `updateSessionIsRegistrationOpenRef()` function to get a reference to the mutation.
const ref = updateSessionIsRegistrationOpenRef(updateSessionIsRegistrationOpenVars);
// Variables can be defined inline as well.
const ref = updateSessionIsRegistrationOpenRef({ id: ..., isRegistrationOpen: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = updateSessionIsRegistrationOpenRef(dataConnect, updateSessionIsRegistrationOpenVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.session_update);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.session_update);
});
```

