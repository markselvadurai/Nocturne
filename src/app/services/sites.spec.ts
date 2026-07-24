import { TestBed } from '@angular/core/testing';

import { Sites } from './sites';

describe('Sites', () => {
  let service: Sites;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sites);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
