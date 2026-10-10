// Public surface of the roles module. Others import only from here.
export { registerRolePanels } from "./interactions";
export { checkRole, createRole, deletePanelMessage, publishPanel } from "./service";
export { whyUnassignable } from "./safety";
