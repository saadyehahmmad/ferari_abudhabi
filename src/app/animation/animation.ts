import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AnimationService } from './animation.service';

@Component({
  selector: 'app-animation',
  imports: [],
  standalone: true,
  templateUrl: './animation.html',
  styleUrl: './animation.scss',
})
export class Animation implements OnInit, OnDestroy {
  @ViewChild('canvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  private resizeHandler?: () => void;
  private mouseMoveHandler?: (event: MouseEvent) => void;
  private mouseDownHandler?: (event: MouseEvent) => void;
  private mouseUpHandler?: (event: MouseEvent) => void;
  private isDragging = false;

  constructor(private animationService: AnimationService) {}

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    this.animationService.initialize(canvas);
    this.animationService.start();

    this.resizeHandler = () => this.animationService.onResize(canvas);
    window.addEventListener('resize', this.resizeHandler);

    this.mouseMoveHandler = (event: MouseEvent) => {
      if (this.isDragging) {
        this.animationService.setMouseX(event.clientX / window.innerWidth);
      }
    };
    window.addEventListener('mousemove', this.mouseMoveHandler);

    this.mouseDownHandler = (event: MouseEvent) => {
      this.isDragging = true;
    };
    window.addEventListener('mousedown', this.mouseDownHandler);

    this.mouseUpHandler = (event: MouseEvent) => {
      this.isDragging = false;
    };
    window.addEventListener('mouseup', this.mouseUpHandler);
  }

  ngOnDestroy(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

    if (this.mouseMoveHandler) {
      window.removeEventListener('mousemove', this.mouseMoveHandler);
      this.mouseMoveHandler = undefined;
    }

    if (this.mouseDownHandler) {
      window.removeEventListener('mousedown', this.mouseDownHandler);
      this.mouseDownHandler = undefined;
    }

    if (this.mouseUpHandler) {
      window.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseUpHandler = undefined;
    }

    this.animationService.dispose();
  }
}
