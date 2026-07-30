import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NightStrip } from './night-strip';

describe('NightStrip', () => {
  let component: NightStrip;
  let fixture: ComponentFixture<NightStrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NightStrip],
    }).compileComponents();

    fixture = TestBed.createComponent(NightStrip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
