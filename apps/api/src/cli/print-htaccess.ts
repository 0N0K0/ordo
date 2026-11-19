import { htaccessBlock } from '../security-headers';

// Printed for scripts/deploy.sh, which writes it in the .htaccess of the app root.
process.stdout.write(htaccessBlock());
