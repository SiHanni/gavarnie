import { Injectable } from '@nestjs/common';
import { RequestContextInterceptor } from '@catarie/logging';

@Injectable()
export class ApiRequestContextInterceptor extends RequestContextInterceptor {}
