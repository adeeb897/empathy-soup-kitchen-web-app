import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RefugeeTasksComponent } from './refugee-tasks.component';

describe('RefugeeTasksComponent', () => {
  let component: RefugeeTasksComponent;
  let fixture: ComponentFixture<RefugeeTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RefugeeTasksComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RefugeeTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
