import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VolunteerShift, SignUp } from '../../../calendar/models/volunteer.model';

/**
 * One row in a shift list, used for both upcoming and past shifts.
 *
 * The two lists were ~90% identical markup differing only in whether the
 * row is editable, so any change to a row had to be made twice. `editable`
 * controls the checkbox, the signup Remove column and the Delete Shift
 * action; past shifts are read-only.
 */
@Component({
    selector: 'app-admin-shift-row',
    imports: [],
    templateUrl: './admin-shift-row.component.html',
    styleUrl: './admin-shift-row.component.scss'
})
export class AdminShiftRowComponent {
  @Input({ required: true }) shift!: VolunteerShift;
  @Input() expanded = false;
  @Input() selected = false;
  /** Past shifts are read-only: no select, no delete. */
  @Input() editable = true;
  @Input() dateLabel = '';
  @Input() timeLabel = '';
  @Input() filledSlots = 0;

  @Output() toggleExpand = new EventEmitter<number>();
  @Output() toggleSelect = new EventEmitter<number>();
  @Output() deleteShift = new EventEmitter<VolunteerShift>();
  @Output() deleteSignup = new EventEmitter<SignUp>();

  get emptyMessage(): string {
    return this.editable ? 'No signups yet.' : 'No signups were recorded.';
  }
}
