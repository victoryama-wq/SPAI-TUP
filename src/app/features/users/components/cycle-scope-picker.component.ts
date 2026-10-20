import { Component, computed, inject, input, output } from '@angular/core';
import { CyclesRepository, CycleStatus } from '../../cycles/data/cycles.repository';

/** Scope cycles are catalog codes (Rules compare cycle/code), not document IDs. */
@Component({
  selector: 'spai-cycle-scope-picker',
  template: `
    <details class="cycle-picker">
      <summary><strong>Ciclos</strong><span>{{ summary() }}</span></summary>
      <div class="cycle-options">
        @if (repository.readState() !== 'ready') {
          <p role="status">{{ repository.readMessage() }} Las selecciones guardadas se conservan.</p>
          @if (repository.readState() === 'error' || repository.readState() === 'denied') {
            <button type="button" (click)="retry()">Reintentar consulta de ciclos</button>
          }
        } @else {
          @if (canGrantGlobal() && !disabled()) {
            <label><input type="checkbox" [checked]="selected().includes('*')" (change)="toggle('*', $any($event.target).checked)" />Todos los ciclos</label>
          }
          @for (group of groups; track group.label) {
            @if (options(group.states).length) {
              <fieldset><legend>{{ group.label }}</legend>
                @for (cycle of options(group.states); track cycle.id) {
                  <label><input type="checkbox" [disabled]="disabled()" [checked]="selected().includes(cycle.code)" (change)="toggle(cycle.code, $any($event.target).checked)" />
                    <span>{{ cycle.label || cycle.code }} · {{ cycle.code }} <small>{{ cycle.status }}</small></span>
                  </label>
                }
              </fieldset>
            }
          }
          @if (!repository.cycles().length) { <p>No hay ciclos disponibles en esta consulta autorizada.</p> }
        }
        @if (unresolved().length) {
          <p role="status">Ciclos guardados no resueltos en el catálogo disponible. Se conservarán hasta que los retires expresamente.</p>
        }
      </div>
    </details>
    <div class="selected-cycles" aria-label="Ciclos seleccionados">
      @for (value of selected(); track value) {
        <span>{{ label(value) }}@if (!disabled()) { <button type="button" [attr.aria-label]="'Retirar ciclo ' + label(value)" (click)="toggle(value, false)">×</button> }</span>
      } @empty { <span>Sin ámbito</span> }
    </div>
    <p class="scope-help">Seleccionar un ciclo concede alcance, sin reabrir captura ni habilitar operaciones bloqueadas por su estado.</p>
  `,
  styles: [`
    :host{display:block;min-width:0;color:#173754}
    .cycle-picker{border:1px solid #b7d2f7;border-radius:8px;background:#fff;overflow:hidden}
    summary{padding:12px;cursor:pointer;line-height:1.5} summary span{display:block;font-weight:400;color:#40577a;overflow-wrap:anywhere}
    .cycle-options{max-height:300px;overflow-y:auto;padding:0 12px 12px}
    fieldset{border:0;border-top:1px solid #d7e4f8;margin:12px 0 0;padding:8px 0}
    legend{font-size:12px;font-weight:900;color:#1457d6;text-transform:uppercase;letter-spacing:.05em}
    label{display:flex;align-items:flex-start;gap:10px;padding:10px 2px;cursor:pointer;font-size:14px;line-height:1.5}
    input{width:18px;height:18px;flex-shrink:0;accent-color:#1457d6;margin-top:2px}
    small{display:block;color:#40577a}p{font-size:13px;line-height:1.5}
    .selected-cycles{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .selected-cycles>span{display:inline-flex;align-items:center;gap:6px;max-width:100%;overflow-wrap:anywhere;background:#edf4ff;border-radius:8px;padding:4px 8px;font-size:13px}
    button{min-height:34px;border:1px solid #b7d2f7;border-radius:6px;background:white;color:#1457d6;cursor:pointer;font:inherit}
    .selected-cycles button{min-width:34px;flex-shrink:0} :focus-visible{outline:3px solid #007eaa;outline-offset:2px}
    .scope-help{color:#40577a;font-weight:400}
  `],
})
export class CycleScopePickerComponent {
  readonly repository = inject(CyclesRepository);
  readonly selected = input.required<string[]>();
  readonly canGrantGlobal = input(false);
  readonly disabled = input(false);
  readonly selectionChange = output<string[]>();
  readonly groups: {label: string; states: CycleStatus[]}[] = [
    {label: 'Ciclo activo', states: ['Captura', 'Captura cerrada']},
    {label: 'Ciclos históricos', states: ['Cerrado']},
    {label: 'Ciclos en preparación', states: ['Preparacion']},
  ];
  options(states: CycleStatus[]) { return this.repository.cycles().filter(cycle => states.includes(cycle.status)); }
  readonly unresolved = computed(() => this.repository.ready() ? this.selected().filter(value => value !== '*' && !this.repository.cycles().some(c => c.code === value)) : []);
  label(value: string): string {
    if (value === '*') return 'Todos';
    const cycle = this.repository.cycles().find(c => c.code === value);
    const state = this.repository.readState();
    return cycle ? `${cycle.label || cycle.code} · ${cycle.code}` : `${value} (${state === 'ready' ? 'no resuelto' : state === 'loading' ? 'pendiente de consulta' : 'consulta no disponible'})`;
  }
  summary(): string { return this.selected().length ? this.selected().map(value => this.label(value)).join(', ') : 'Seleccionar ciclos · Sin ámbito'; }
  toggle(value: string, checked: boolean): void {
    if (this.disabled() || (checked && value === '*' && !this.canGrantGlobal())) return;
    if (checked && (this.repository.readState() !== 'ready' || value !== '*' && !this.repository.cycles().some(c => c.code === value))) return;
    const next = checked ? value === '*' ? ['*'] : [...this.selected().filter(v => v !== '*'), value] : this.selected().filter(v => v !== value);
    this.selectionChange.emit([...new Set(next)]);
  }
  async retry(): Promise<void> { try { await this.repository.refreshFromServer(); } catch { /* Repository exposes the error state. */ } }
}
