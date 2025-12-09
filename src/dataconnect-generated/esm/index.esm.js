import { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'example',
  service: 'workshopsaicms',
  location: 'us-east4'
};

export const createWorkshopRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateWorkshop', inputVars);
}
createWorkshopRef.operationName = 'CreateWorkshop';

export function createWorkshop(dcOrVars, vars) {
  return executeMutation(createWorkshopRef(dcOrVars, vars));
}

export const listWorkshopsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListWorkshops');
}
listWorkshopsRef.operationName = 'ListWorkshops';

export function listWorkshops(dc) {
  return executeQuery(listWorkshopsRef(dc));
}

export const updateSessionIsRegistrationOpenRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSessionIsRegistrationOpen', inputVars);
}
updateSessionIsRegistrationOpenRef.operationName = 'UpdateSessionIsRegistrationOpen';

export function updateSessionIsRegistrationOpen(dcOrVars, vars) {
  return executeMutation(updateSessionIsRegistrationOpenRef(dcOrVars, vars));
}

export const getSessionsByWorkshopIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSessionsByWorkshopId', inputVars);
}
getSessionsByWorkshopIdRef.operationName = 'GetSessionsByWorkshopId';

export function getSessionsByWorkshopId(dcOrVars, vars) {
  return executeQuery(getSessionsByWorkshopIdRef(dcOrVars, vars));
}

