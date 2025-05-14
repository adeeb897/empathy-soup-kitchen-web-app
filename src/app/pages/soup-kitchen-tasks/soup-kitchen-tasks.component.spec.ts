import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SoupKitchenTasksComponent } from './soup-kitchen-tasks.component';

describe('SoupKitchenTasksComponent', () => {
  let component: SoupKitchenTasksComponent;
  let fixture: ComponentFixture<SoupKitchenTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoupKitchenTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SoupKitchenTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
