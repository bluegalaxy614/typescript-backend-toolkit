import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RoleType } from '../enums';
import { getUserById } from '../user/user.services';
import { errorResponse } from '../utils/api.utils';
import { JwtPayload } from '../utils/auth.utils';

export type CanAccessByType = 'roles';

export type CanAccessOptions = {
  roles: RoleType | '*';
};

export const canAccess =
  <T extends CanAccessByType>(by?: T, access?: CanAccessOptions[T][]) =>
  async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    req: Request<any, any, any, any>,
    res: Response,
    next?: NextFunction,
  ) => {
    try {
      const requestUser = req?.user as JwtPayload;

      if (!requestUser) {
        return errorResponse(
          res,
          "token isn't attached or expired",
          StatusCodes.UNAUTHORIZED,
        );
      }
      const currentUser = await getUserById({ id: requestUser.sub });

      if (!currentUser) {
        return errorResponse(res, 'Login again', StatusCodes.UNAUTHORIZED);
      }

      if (currentUser.otp !== null) {
        return errorResponse(
          res,
          'Your account is not verified',
          StatusCodes.UNAUTHORIZED,
        );
      }

      if (!currentUser.isActive) {
        return errorResponse(
          res,
          'Your account has been disabled',
          StatusCodes.UNAUTHORIZED,
        );
      }

      let can = false;

      const accessorsToScanFor = access;

      if (by === 'roles' && accessorsToScanFor) {
        can = (accessorsToScanFor as RoleType[]).includes(
          currentUser.role as RoleType,
        );
      }

      if (!accessorsToScanFor) {
        can = Boolean(currentUser.email);
      }

      if (!can && by === 'roles') {
        return errorResponse(
          res,
          'User is not authorized to perform this action',
          StatusCodes.UNAUTHORIZED,
          { [`${by}_required`]: access },
        );
      }

      if (currentUser && !by && !access) {
        can = true;
      }

      if (!can) {
        return errorResponse(
          res,
          'User is not authenticated',
          StatusCodes.UNAUTHORIZED,
          access,
        );
      }

      if (currentUser) {
        req['user'] = { ...currentUser, sub: currentUser._id };
      }
    } catch (err) {
      return errorResponse(
        res,
        (err as Error).message,
        StatusCodes.UNAUTHORIZED,
        access,
      );
    }

    next?.();
  };
