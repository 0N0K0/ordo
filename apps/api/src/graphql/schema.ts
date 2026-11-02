import { builder } from './builder';
import './modules/health';
import './modules/user';
import './modules/auth';
import './modules/workspace';
import './modules/tasks';
import './modules/time';
import './modules/mail';
import './modules/calendar';
import './modules/accounting';

export const schema = builder.toSchema();
