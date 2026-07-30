import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

const TRACES: Record<string, string> = {
  jauge: 'M3 13a9 9 0 1 1 18 0M12 13l4-3',
  grille: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  horloge: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bouclier: 'M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z',
  calendrier: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  contacts: 'M5 4h14v17H5zM9 9h6M9 13h6M9 17h3',
  megaphone: 'M4 10v4h3l7 4V6l-7 4H4zM18 9a4 4 0 0 1 0 6',
  retour: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  loupe: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  soleil: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
  lune: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
  poubelle: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  crayon: 'M4 20h4L20 8l-4-4L4 16z',
  envoi: 'M4 12l16-8-6 16-2.5-6z',
  eclair: 'M13 3L5 14h6l-1 7 8-11h-6z',
  coche: 'M4 12.5l5 5 11-11',
  croix: 'M6 6l12 12M18 6L6 18',
  flux: 'M3 8h11M11 5l3 3-3 3M21 16H10M13 13l-3 3 3 3',
  oeil: 'M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  sablier: 'M7 3h10M7 21h10M8 3v3.5c0 2 4 3.3 4 5.5s-4 3.5-4 5.5V21M16 3v3.5c0 2-4 3.3-4 5.5s4 3.5 4 5.5V21',
  carte: 'M4 7h5v5H4zM15 4h5v5h-5zM15 15h5v5h-5zM9 9.5h6M9 16h6M12 12v4',
  video: 'M3 6h13v12H3zM16 10l5-3v10l-5-3',
  lien: 'M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.5 6M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7L12.5 18',
};

@Component({
  selector: 'mco-icone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="taille"
      [attr.height]="taille"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="trace" />
    </svg>
  `,
  styles: [':host { display: inline-flex; line-height: 0; }'],
})
export class IconeComponent {
  @Input({ required: true }) nom!: string;
  @Input() taille = 18;

  get trace(): string {
    return TRACES[this.nom] ?? '';
  }
}
