import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { captureMagicLinkToken } from './app/shared/utils/magic-link-token';

// Runs before the router, so a redirect cannot lose the token. Magic links
// sent before the admin moved to /admin still point at /volunteer/admin, and
// Angular's redirectTo drops query params.
captureMagicLinkToken();

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
