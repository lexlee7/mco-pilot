import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Indispensable : sans cet enregistrement, tout formatage de date en français
// lève une erreur qui interrompt le cycle de détection de changement d'Angular.
// Conséquence visible : la vue se fige (boutons sans effet) alors que l'état
// applicatif, lui, continue d'être mis à jour.
registerLocaleData(localeFr, 'fr');

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
