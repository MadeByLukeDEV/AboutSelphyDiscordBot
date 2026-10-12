// Public surface of the dashboard's audit module. Pages import only from here; actions use audited().
export { audited } from "./audited";
export { getAuditPage, type AuditRow } from "./service";
export { splitAction } from "./rules";
