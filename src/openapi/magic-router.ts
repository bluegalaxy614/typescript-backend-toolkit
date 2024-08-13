import { NextFunction, Request, Response, Router } from 'express';
import asyncHandler from 'express-async-handler';
import { ZodTypeAny } from 'zod';
import { validateZodSchema } from '../middlewares/validate-zod-schema.middleware';
import { RequestZodSchemaType } from '../types';
import {
  camelCaseToTitleCase,
  parseRouteString,
  routeToClassName,
} from './openapi.utils';
import { bearerAuth, registry } from './swagger-instance';
import { canAccess } from '../middlewares/can-access.middleware';

type Method =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'head'
  | 'options'
  | 'trace';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IDontKnow = unknown | never | any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MaybePromise = void | Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RequestAny = Request<IDontKnow, IDontKnow, IDontKnow, IDontKnow>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResponseAny = Response<IDontKnow, Record<string, any>>;

export type RequestAndResponseType = {
  requestType?: RequestZodSchemaType;
  responseModel?: ZodTypeAny;
};

export class MagicRouter {
  private router: Router;
  private rootRoute: string;

  constructor(rootRoute: string) {
    this.router = Router();
    this.rootRoute = rootRoute;
  }

  private getPath(path: string) {
    return this.rootRoute + parseRouteString(path);
  }

  private wrapper(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    method: Method,
    path: string,
    requestAndResponseType: RequestAndResponseType,
    ...middlewares: Array<
      (req: RequestAny, res: ResponseAny, next?: NextFunction) => MaybePromise
    >
  ): void {
    const bodyType = requestAndResponseType.requestType?.body;
    const paramsType = requestAndResponseType.requestType?.params;
    const queryType = requestAndResponseType.requestType?.query;
    const responseType = requestAndResponseType.responseModel ?? {};

    const className = routeToClassName(this.rootRoute);

    const bodySchema = bodyType ? registry.register(className, bodyType) : null;

    const hasSecurity = middlewares.some((m) => m.name === canAccess().name);

    registry.registerPath({
      method: method,
      tags: [className],
      path: this.getPath(path),
      security: hasSecurity ? [{ [bearerAuth.name]: ['bearer'] }] : [],
      description: camelCaseToTitleCase(
        middlewares[middlewares.length - 1]?.name,
      ),
      summary: camelCaseToTitleCase(middlewares[middlewares.length - 1]?.name),
      request: {
        params: paramsType,
        query: queryType,
        ...(bodySchema
          ? {
              body: {
                content: {
                  'application/json': {
                    schema: bodySchema,
                  },
                },
              },
            }
          : {}),
      },
      responses: {
        200: {
          description: '',
          content: {
            'application/json': {
              schema: responseType,
            },
          },
        },
      },
    });

    const requestType = requestAndResponseType.requestType ?? {};

    const controller = asyncHandler(middlewares[middlewares.length - 1]);

    middlewares.pop();

    if (Object.keys(requestType).length) {
      this.router[method](
        path,
        validateZodSchema(requestType),
        ...middlewares,
        controller,
      );
    } else {
      this.router[method](path, ...middlewares, controller);
    }
  }

  public get(
    path: string,
    requestAndResponseType: RequestAndResponseType,
    ...middlewares: Array<
      (req: RequestAny, res: ResponseAny, next?: NextFunction) => MaybePromise
    >
  ): void {
    this.wrapper('get', path, requestAndResponseType, ...middlewares);
  }

  public post(
    path: string,
    requestAndResponseType: RequestAndResponseType,
    ...middlewares: Array<
      (req: RequestAny, res: ResponseAny, next?: NextFunction) => MaybePromise
    >
  ): void {
    this.wrapper('post', path, requestAndResponseType, ...middlewares);
  }

  public delete(
    path: string,
    requestAndResponseType: RequestAndResponseType,
    ...middlewares: Array<
      (req: RequestAny, res: ResponseAny, next?: NextFunction) => MaybePromise
    >
  ): void {
    this.wrapper('delete', path, requestAndResponseType, ...middlewares);
  }

  public patch(
    path: string,
    requestAndResponseType: RequestAndResponseType,
    ...middlewares: Array<
      (req: RequestAny, res: ResponseAny, next?: NextFunction) => MaybePromise
    >
  ): void {
    this.wrapper('patch', path, requestAndResponseType, ...middlewares);
  }

  public put(
    path: string,
    requestAndResponseType: RequestAndResponseType,
    ...middlewares: Array<
      (req: RequestAny, res: ResponseAny, next?: NextFunction) => MaybePromise
    >
  ): void {
    this.wrapper('put', path, requestAndResponseType, ...middlewares);
  }
  public use(...args: Parameters<Router['use']>): void {
    this.router.use(...args);
  }

  // Method to get the router instance
  public getRouter(): Router {
    return this.router;
  }
}

export default MagicRouter;
