export class InputManager {
  keys: { [key: string]: boolean } = {};
  mouse: { x: number; y: number; left: boolean; right: boolean } = { x: 0, y: 0, left: false, right: false };
  canvas: HTMLCanvasElement;
  onFirstInteraction?: () => void;
  hasInteracted = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  triggerInteraction() {
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      if (this.onFirstInteraction) this.onFirstInteraction();
    }
  }

  handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };
  handleKeyDown = (e: KeyboardEvent) => { 
    this.keys[e.code] = true; 
    this.triggerInteraction();
  };
  handleKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
  handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * scaleX;
    this.mouse.y = (e.clientY - rect.top) * scaleY;
  };
  handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = true;
    if (e.button === 2) this.mouse.right = true;
    this.triggerInteraction();
  };
  handleMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.left = false;
    if (e.button === 2) this.mouse.right = false;
  };

  isKeyDown(code: string) { return !!this.keys[code]; }
}
