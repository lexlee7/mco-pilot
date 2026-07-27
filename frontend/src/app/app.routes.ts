import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tableau-de-bord' },
  {
    path: 'tableau-de-bord',
    title: 'Tableau de bord — MCO',
    loadComponent: () => import('./pages/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'applications',
    title: 'Parc applicatif — MCO',
    loadComponent: () =>
      import('./pages/applications.component').then((m) => m.ApplicationsComponent),
  },
  {
    path: 'applications/:id',
    title: 'Fiche application — MCO',
    loadComponent: () =>
      import('./pages/application-detail.component').then((m) => m.ApplicationDetailComponent),
  },
  {
    path: 'plages',
    title: 'Recherche de créneau — MCO',
    loadComponent: () => import('./pages/maintenance.component').then((m) => m.MaintenanceComponent),
  },
  {
    path: 'vulnerabilites',
    title: 'Vulnérabilités — MCO',
    loadComponent: () =>
      import('./pages/vulnerabilites.component').then((m) => m.VulnerabilitesComponent),
  },
  {
    path: 'calendrier',
    title: 'Calendrier MCO',
    loadComponent: () => import('./pages/calendrier.component').then((m) => m.CalendrierComponent),
  },
  {
    path: 'partenaires',
    title: 'Éditeurs et partenaires — MCO',
    loadComponent: () => import('./pages/partenaires.component').then((m) => m.PartenairesComponent),
  },
  {
    path: 'communication',
    title: 'Communication de crise — MCO',
    loadComponent: () =>
      import('./pages/communication.component').then((m) => m.CommunicationComponent),
  },
  { path: '**', redirectTo: 'tableau-de-bord' },
];
