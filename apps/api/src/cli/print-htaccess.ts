import { htaccessSecurityBlock } from '../security-headers';

// Printed for scripts/deploy.sh, which writes it in the .htaccess of the built web app.
process.stdout.write(htaccessSecurityBlock());
