import { AsyncPipe, CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MenuComponentService } from './menu-component.service';

@Component({
  selector: 'libs-menu',
  standalone: true,
  imports: [MatToolbarModule, MatIconModule, MatButtonModule, CommonModule, AsyncPipe],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  providers: [ MenuComponentService ]
})
export class MenuComponent implements AfterViewInit, OnDestroy {
  @ViewChild('grid') grid?: ElementRef;

  public apps$ = this.menu_service.apps$;
  public current_app$ = this.menu_service.current_app$;
  private resize_observer?: ResizeObserver;

  constructor(private readonly menu_service: MenuComponentService, private readonly zone: NgZone, private readonly element: ElementRef,){}

  public ngAfterViewInit(): void {
    this.resize_observer = new ResizeObserver(() => this.zone.run(() => this.detectResize()));
    this.resize_observer.observe(this.element?.nativeElement);
  }

  public ngOnDestroy(): void {
    this.resize_observer?.disconnect();
  }

  public addApp(): void {
    this.menu_service.addRandomApp();
  }

  public deleteCurrentApp() {
    this.menu_service.deleteCurrentApp();
  }

  private detectResize() {
    const grid_columns_count = window.getComputedStyle(this.grid?.nativeElement).getPropertyValue("grid-template-columns").split(" ").length;
    this.menu_service.columns_count$.next(grid_columns_count);
  }
}
