import { builder } from './builder';
import './modules/health';
import './modules/user';
import './modules/auth';
import './modules/workspace';
import './modules/tasks';
import './modules/time';

export const schema = builder.toSchema();
