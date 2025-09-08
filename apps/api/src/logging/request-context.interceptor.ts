import { Injectable } from '@nestjs/common';
import { RequestContextInterceptor } from '@libs/logging';

@Injectable()
export class ApiRequestContextInterceptor extends RequestContextInterceptor {}
