import { builder } from './builder';
import './modules/health';
import './modules/user';
import './modules/auth';
import './modules/workspace';

export const schema = builder.toSchema();
