import { builder } from './builder';
import './modules/health';
import './modules/user';
import './modules/auth';

export const schema = builder.toSchema();
