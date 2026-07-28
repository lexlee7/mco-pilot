import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import {
  Application,
  ApplicationDetail,
  Cartographie,
  Dojo,
  DashboardStats,
  Dispositif,
  DocumentApp,
  Evenement,
  Flux,
  HistoriqueComm,
  ListeDiffusion,
  OccurrencePlage,
  Obsolescence,
  Partenaire,
  Plage,
  PlanningObsolescences,
  Referentiels,
  ReponseCreneaux,
  TemplateComm,
  Vulnerabilite,
} from './models';

/**
 * En développement le front tourne sur le port 4200 et l'API sur le port 8000.
 * En production les deux sont servis par la même instance : l'URL est relative.
 */
function baseApi(): string {
  const { protocol, hostname, port } = window.location;
  return port === '4200' ? `${protocol}//${hostname}:8000` : '';
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = baseApi();
  private referentielsCache?: Observable<Referentiels>;

  // ------------------------------------------------------------ Référentiels
  referentiels(): Observable<Referentiels> {
    this.referentielsCache ??= this.http
      .get<Referentiels>(`${this.base}/api/referentiels`)
      .pipe(shareReplay(1));
    return this.referentielsCache;
  }

  // ------------------------------------------------------------ Dashboard
  dashboard(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.base}/api/dashboard`);
  }

  // ------------------------------------------------------------ Applications
  listerApplications(filtres: Record<string, string | undefined> = {}): Observable<Application[]> {
    let params = new HttpParams();
    Object.entries(filtres).forEach(([cle, valeur]) => {
      if (valeur) params = params.set(cle, valeur);
    });
    return this.http.get<Application[]>(`${this.base}/api/applications`, { params });
  }

  application(id: number): Observable<ApplicationDetail> {
    return this.http.get<ApplicationDetail>(`${this.base}/api/applications/${id}`);
  }

  creerApplication(corps: Partial<Application>): Observable<ApplicationDetail> {
    return this.http.post<ApplicationDetail>(`${this.base}/api/applications`, corps);
  }

  modifierApplication(id: number, corps: Partial<Application>): Observable<ApplicationDetail> {
    return this.http.put<ApplicationDetail>(`${this.base}/api/applications/${id}`, corps);
  }

  supprimerApplication(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/applications/${id}`);
  }

  // ------------------------------------------------------------ Sous-ressources
  ajouterPlage(appId: number, corps: Partial<Plage>): Observable<Plage> {
    return this.http.post<Plage>(`${this.base}/api/applications/${appId}/plages`, corps);
  }
  supprimerPlage(appId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/applications/${appId}/plages/${id}`);
  }

  ajouterFlux(appId: number, corps: Partial<Flux>): Observable<Flux> {
    return this.http.post<Flux>(`${this.base}/api/applications/${appId}/flux`, corps);
  }
  supprimerFlux(appId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/applications/${appId}/flux/${id}`);
  }

  ajouterDocument(appId: number, corps: Partial<DocumentApp>): Observable<DocumentApp> {
    return this.http.post<DocumentApp>(`${this.base}/api/applications/${appId}/documents`, corps);
  }
  modifierDocument(appId: number, id: number, corps: Partial<DocumentApp>): Observable<DocumentApp> {
    return this.http.put<DocumentApp>(`${this.base}/api/applications/${appId}/documents/${id}`, corps);
  }
  supprimerDocument(appId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/applications/${appId}/documents/${id}`);
  }

  ajouterDispositif(appId: number, corps: Partial<Dispositif>): Observable<Dispositif> {
    return this.http.post<Dispositif>(`${this.base}/api/applications/${appId}/dispositifs`, corps);
  }
  supprimerDispositif(appId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/applications/${appId}/dispositifs/${id}`);
  }

  ajouterDojo(appId: number, corps: Partial<Dojo>): Observable<Dojo> {
    return this.http.post<Dojo>(`${this.base}/api/applications/${appId}/dojos`, corps);
  }
  supprimerDojo(appId: number, id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/applications/${appId}/dojos/${id}`);
  }

  cartographie(appId: number): Observable<Cartographie> {
    return this.http.get<Cartographie>(`${this.base}/api/applications/${appId}/cartographie`);
  }

  // ------------------------------------------------------------ Obsolescences
  listerObsolescences(filtres: Record<string, string | undefined> = {}): Observable<Obsolescence[]> {
    let params = new HttpParams();
    Object.entries(filtres).forEach(([cle, valeur]) => {
      if (valeur) params = params.set(cle, valeur);
    });
    return this.http.get<Obsolescence[]>(`${this.base}/api/obsolescences`, { params });
  }
  planningObsolescences(): Observable<PlanningObsolescences> {
    return this.http.get<PlanningObsolescences>(`${this.base}/api/obsolescences/planning`);
  }
  composantsObsoletes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/api/obsolescences/composants`);
  }
  creerObsolescence(corps: Partial<Obsolescence>): Observable<Obsolescence> {
    return this.http.post<Obsolescence>(`${this.base}/api/obsolescences`, corps);
  }
  modifierObsolescence(id: number, corps: Partial<Obsolescence>): Observable<Obsolescence> {
    return this.http.put<Obsolescence>(`${this.base}/api/obsolescences/${id}`, corps);
  }
  supprimerObsolescence(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/obsolescences/${id}`);
  }

  // ------------------------------------------------------------ Partenaires
  listerPartenaires(recherche?: string): Observable<Partenaire[]> {
    let params = new HttpParams();
    if (recherche) params = params.set('recherche', recherche);
    return this.http.get<Partenaire[]>(`${this.base}/api/partenaires`, { params });
  }
  creerPartenaire(corps: Partial<Partenaire>): Observable<Partenaire> {
    return this.http.post<Partenaire>(`${this.base}/api/partenaires`, corps);
  }
  modifierPartenaire(id: number, corps: Partial<Partenaire>): Observable<Partenaire> {
    return this.http.put<Partenaire>(`${this.base}/api/partenaires/${id}`, corps);
  }
  supprimerPartenaire(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/partenaires/${id}`);
  }

  // ------------------------------------------------------------ Vulnérabilités
  listerVulnerabilites(filtres: Record<string, string | undefined> = {}): Observable<Vulnerabilite[]> {
    let params = new HttpParams();
    Object.entries(filtres).forEach(([cle, valeur]) => {
      if (valeur) params = params.set(cle, valeur);
    });
    return this.http.get<Vulnerabilite[]>(`${this.base}/api/vulnerabilites`, { params });
  }
  creerVulnerabilite(corps: unknown): Observable<Vulnerabilite> {
    return this.http.post<Vulnerabilite>(`${this.base}/api/vulnerabilites`, corps);
  }
  modifierVulnerabilite(id: number, corps: unknown): Observable<Vulnerabilite> {
    return this.http.put<Vulnerabilite>(`${this.base}/api/vulnerabilites/${id}`, corps);
  }
  supprimerVulnerabilite(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/vulnerabilites/${id}`);
  }
  majAvancement(vulnId: number, appId: number, statut: string): Observable<Vulnerabilite> {
    const params = new HttpParams().set('statut', statut);
    return this.http.patch<Vulnerabilite>(
      `${this.base}/api/vulnerabilites/${vulnId}/applications/${appId}`,
      {},
      { params },
    );
  }
  declencherRelances(): Observable<{ nb_destinataires: number }> {
    return this.http.post<{ nb_destinataires: number }>(
      `${this.base}/api/vulnerabilites/relances/declencher`, {});
  }
  declencherRecapitulatif(): Observable<{ statut: string; detail: string }> {
    return this.http.post<{ statut: string; detail: string }>(
      `${this.base}/api/vulnerabilites/relances/recapitulatif`, {});
  }

  // ------------------------------------------------------------ Maintenance
  rechercherCreneaux(corps: unknown): Observable<ReponseCreneaux> {
    return this.http.post<ReponseCreneaux>(`${this.base}/api/maintenance/recherche`, corps);
  }
  couverture(): Observable<{ nb_applications: number; grille: number[][] }> {
    return this.http.get<{ nb_applications: number; grille: number[][] }>(
      `${this.base}/api/maintenance/couverture`);
  }

  // ------------------------------------------------------------ Calendrier
  listerEvenements(): Observable<Evenement[]> {
    return this.http.get<Evenement[]>(`${this.base}/api/evenements`);
  }
  creerEvenement(corps: unknown): Observable<Evenement> {
    return this.http.post<Evenement>(`${this.base}/api/evenements`, corps);
  }
  supprimerEvenement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/evenements/${id}`);
  }
  projectionPlages(nbJours = 28): Observable<OccurrencePlage[]> {
    const params = new HttpParams().set('nb_jours', nbJours);
    return this.http.get<OccurrencePlage[]>(`${this.base}/api/evenements/plages/projection`, { params });
  }

  // ------------------------------------------------------------ Communication
  listerListes(): Observable<ListeDiffusion[]> {
    return this.http.get<ListeDiffusion[]>(`${this.base}/api/communication/listes`);
  }
  creerListe(corps: Partial<ListeDiffusion>): Observable<ListeDiffusion> {
    return this.http.post<ListeDiffusion>(`${this.base}/api/communication/listes`, corps);
  }
  modifierListe(id: number, corps: Partial<ListeDiffusion>): Observable<ListeDiffusion> {
    return this.http.put<ListeDiffusion>(`${this.base}/api/communication/listes/${id}`, corps);
  }
  supprimerListe(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/communication/listes/${id}`);
  }

  listerTemplates(): Observable<TemplateComm[]> {
    return this.http.get<TemplateComm[]>(`${this.base}/api/communication/templates`);
  }
  creerTemplate(corps: Partial<TemplateComm>): Observable<TemplateComm> {
    return this.http.post<TemplateComm>(`${this.base}/api/communication/templates`, corps);
  }
  modifierTemplate(id: number, corps: Partial<TemplateComm>): Observable<TemplateComm> {
    return this.http.put<TemplateComm>(`${this.base}/api/communication/templates/${id}`, corps);
  }
  supprimerTemplate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/api/communication/templates/${id}`);
  }

  etatMessagerie(): Observable<{ mode_simulation: boolean; message: string }> {
    return this.http.get<{ mode_simulation: boolean; message: string }>(
      `${this.base}/api/communication/etat-messagerie`);
  }
  envoyerCommunication(corps: unknown): Observable<{
    statut: string; nb_destinataires: number; destinataires: string[]; detail: string;
  }> {
    return this.http.post<{
      statut: string; nb_destinataires: number; destinataires: string[]; detail: string;
    }>(`${this.base}/api/communication/envoyer`, corps);
  }
  historiqueCommunications(): Observable<HistoriqueComm[]> {
    return this.http.get<HistoriqueComm[]>(`${this.base}/api/communication/historique`);
  }
}
