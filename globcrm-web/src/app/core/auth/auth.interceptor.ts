import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Placeholder - full implementation in Task 2
  return next(req);
};
