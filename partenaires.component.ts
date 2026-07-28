import { Injectable, signal } from '@angular/core';

export type Theme = 'sombre' | 'clair';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>('sombre');

  constructor() {
    const memorise = localStorage.getItem('mco-theme') as Theme | null;
    const prefereClair = window.matchMedia?.('(prefers-color-scheme: light)').matches;
    this.appliquer(memorise ?? (prefereClair ? 'clair' : 'sombre'));
  }

  basculer(): void {
    this.appliquer(this.theme() === 'sombre' ? 'clair' : 'sombre');
  }

  private appliquer(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mco-theme', theme);
  }
}

export interface Notification {
  id: number;
  texte: string;
  ton: 'succes' | 'erreur' | 'info';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly notifications = signal<Notification[]>([]);
  private compteur = 0;

  succes(texte: string) { this.pousser(texte, 'succes'); }
  erreur(texte: string) { this.pousser(texte, 'erreur'); }
  info(texte: string) { this.pousser(texte, 'info'); }

  fermer(id: number): void {
    this.notifications.update((liste) => liste.filter((n) => n.id !== id));
  }

  private pousser(texte: string, ton: Notification['ton']): void {
    const id = ++this.compteur;
    this.notifications.update((liste) => [...liste, { id, texte, ton }]);
    setTimeout(() => this.fermer(id), 4600);
  }
}
