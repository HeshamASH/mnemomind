import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ElasticService } from './elastic';

describe('ElasticService', () => {
  let service: ElasticService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(ElasticService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
