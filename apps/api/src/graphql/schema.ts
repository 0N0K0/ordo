import { builder } from './builder';
import './modules/health';
import './modules/user';
import './modules/auth';
import './modules/workspace';
import './modules/tasks';

export const schema = builder.toSchema();
