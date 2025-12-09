const { queryRef, executeQuery, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'workshopsaicms',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const createWorkshopRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateWorkshop', inputVars);
}
createWorkshopRef.operationName = 'CreateWorkshop';
exports.createWorkshopRef = createWorkshopRef;

exports.createWorkshop = function createWorkshop(dcOrVars, vars) {
  return executeMutation(createWorkshopRef(dcOrVars, vars));
};

const listWorkshopsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'ListWorkshops');
}
listWorkshopsRef.operationName = 'ListWorkshops';
exports.listWorkshopsRef = listWorkshopsRef;

exports.listWorkshops = function listWorkshops(dc) {
  return executeQuery(listWorkshopsRef(dc));
};

const updateSessionIsRegistrationOpenRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpdateSessionIsRegistrationOpen', inputVars);
}
updateSessionIsRegistrationOpenRef.operationName = 'UpdateSessionIsRegistrationOpen';
exports.updateSessionIsRegistrationOpenRef = updateSessionIsRegistrationOpenRef;

exports.updateSessionIsRegistrationOpen = function updateSessionIsRegistrationOpen(dcOrVars, vars) {
  return executeMutation(updateSessionIsRegistrationOpenRef(dcOrVars, vars));
};

const getSessionsByWorkshopIdRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetSessionsByWorkshopId', inputVars);
}
getSessionsByWorkshopIdRef.operationName = 'GetSessionsByWorkshopId';
exports.getSessionsByWorkshopIdRef = getSessionsByWorkshopIdRef;

exports.getSessionsByWorkshopId = function getSessionsByWorkshopId(dcOrVars, vars) {
  return executeQuery(getSessionsByWorkshopIdRef(dcOrVars, vars));
};
