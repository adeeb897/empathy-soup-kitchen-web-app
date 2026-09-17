import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextBoxService } from '../../calendar/services/text-box.service';
import { ToastService } from '../../../shared/services/toast.service';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';

interface EditableText {
  name: string;
  label: string;
  description: string;
  content: string;
  original: string;
  saving: boolean;
}

/**
 * Editing for the site's configurable text.
 *
 * TextBoxService has always supported writes, but nothing called them — the
 * copy could only be changed by hitting the API by hand. This is that
 * missing surface.
 */
@Component({
    selector: 'app-admin-settings',
    imports: [FormsModule, StatePanelComponent],
    templateUrl: './admin-settings.component.html',
    styleUrl: './admin-settings.component.scss'
})
export class AdminSettingsComponent implements OnInit {
  /** Every text box the site renders. Add a row here when a new one is used. */
  private readonly known = [
    {
      name: 'VolunteerInstructions',
      label: 'Volunteer page instructions',
      description: 'Shown under the heading on the Volunteer page.',
    },
  ];

  texts: EditableText[] = [];
  loading = false;
  error = '';

  constructor(
    private textBoxService: TextBoxService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.texts = await Promise.all(
        this.known.map(async (t) => {
          const content = (await this.textBoxService.getTextByName(t.name)) ?? '';
          return { ...t, content, original: content, saving: false };
        })
      );
    } catch (e) {
      this.error = 'Could not load the site text. Please try again.';
      console.error('Failed to load text boxes:', e);
    } finally {
      this.loading = false;
    }
  }

  isDirty(text: EditableText): boolean {
    return text.content !== text.original;
  }

  revert(text: EditableText): void {
    text.content = text.original;
  }

  async save(text: EditableText): Promise<void> {
    if (!this.isDirty(text) || text.saving) return;

    text.saving = true;
    try {
      // updateText resolves false rather than throwing when the API is
      // unreachable, which would otherwise leave the browser copy diverged
      // from the server without telling anyone.
      const saved = await this.textBoxService.updateText(text.name, text.content);
      if (saved) {
        text.original = text.content;
        this.toastService.success('Saved');
      } else {
        this.toastService.error('Could not save — the change was not stored.');
      }
    } catch (e) {
      this.toastService.error('Could not save. Please try again.');
      console.error('Failed to save text box:', e);
    } finally {
      text.saving = false;
    }
  }
}
