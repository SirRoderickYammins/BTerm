import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { getBookingsView, getCurrentUser, getUserHours } from "./matrix";
import { UserPlanningTime, BookingInformation } from "./types/sessionTypes";
import {
  startOfWeek,
  addDays,
  setHours,
  addMinutes,
  setMinutes,
  setSeconds,
  differenceInMinutes,
  endOfWeek,
  addHours,
  endOfDay,
  compareAsc,
  isEqual,
} from "date-fns";
import { utcToZonedTime, zonedTimeToUtc, format } from "date-fns-tz";
const holidays = require("@date/holidays-us");
import { currentPayPeriod, currentUser } from "./current-user";
import { createReservation } from "./matrix/createReservation";
import { createImportSpecifier } from "typescript";

const jar = new CookieJar();
export const client = wrapper(axios.create({ jar }));

const loginInfo = new URLSearchParams({
  UserName: process.env.USER_NAME ?? "",
  Password: process.env.PASSWORD ?? "",
}).toString();

export let accessToken = "";

export const login = async () => {
  await client
    .post(
      "https://matrix.fusionacademy.com/Account/Login?ReturnUrl=%2F",
      loginInfo,
      { withCredentials: true }
    )
    .then(() => {
      const cookies = jar.getCookiesSync("https://matrix.fusionacademy.com");
      accessToken = cookies[0].value;
    })
    .catch((err) => {
      console.log("Matrix is down.");
    });
};

export const PlanningTimeBalance = async (): Promise<
  UserPlanningTime["earnedPlanningTime"]["planningTimeBalanceMinutes"]
> => {
  const userInfo = await getUserHours(
    (
      await getCurrentUser()
    ).defaultCampusHashKey
  );
  const currentPlanningTimeBalance =
    userInfo.earnedPlanningTime.planningTimeBalanceMinutes -
    userInfo.earnedPlanningTime.usedPlanningTimeMinutes;
  return currentPlanningTimeBalance;
};

const formatDate = (date: Date) => {
  return format(date, "yyyy-MM-dd'T'HH:mm:ssXXXXX", {
    timeZone: currentUser.iana,
  });
};

export const GetScheduleFreeTime = async (booking_info: BookingInformation) => {
  const { reservations, staffAvailabilities } = booking_info;
  const bookedSlots = [...reservations, ...staffAvailabilities];

  const scheduleWindowBeginningOfWeek = addHours(
    addDays(
      startOfWeek(utcToZonedTime(currentPayPeriod.startDate, currentUser.iana)),
      2
    ),
    7
  );
  const scheduleWindowEndOfWeek = endOfWeek(
    utcToZonedTime(currentPayPeriod.startDate, currentUser.iana)
  );
  const endofDay = addHours(scheduleWindowBeginningOfWeek, 12);

  const bookings = await getBookingsView();

  const BookedTimes = bookings.reservations.map((eachSlot) => {
    return eachSlot.startDate, eachSlot.endDate;
  });

  let FreeSlots: Date[] = [];

  var currentDay = scheduleWindowBeginningOfWeek;

  while (isEqual(currentDay, endofDay) == false) {
    FreeSlots.push(currentDay);

    currentDay = addMinutes(currentDay, 30);
  }

  const OpenTimes = FreeSlots.map((eachSlot) => {
    if (BookedTimes.includes(formatDate(eachSlot))) {
      FreeSlots.pop();
    } else {
      return formatDate(eachSlot);
    }
  });

  console.log(OpenTimes);
};
