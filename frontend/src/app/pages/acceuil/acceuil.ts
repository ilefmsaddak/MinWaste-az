import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavBar } from '../../components/nav-bar/nav-bar';
import { Banner } from '../../components/banner/banner';
import { AnnonceCards } from '../../components/annonce-cards/annonce-cards';
import { Leaderboard } from '../../components/leaderboard/leaderboard';

@Component({
  selector: 'app-acceuil',
  imports: [NavBar, Banner, AnnonceCards, Leaderboard, RouterLink],
  templateUrl: './acceuil.html',
  styleUrl: './acceuil.scss',
})
export class Acceuil {
  activeSection = signal<string>('for-you');

  onFilterClick(section: string) {
    this.activeSection.set(section);
  }
}
