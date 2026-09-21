-- Flight to Hometown benefit — expat support for a periodic flight home.
--
-- Two columns, not one, because "who it covers" and "what cabin class" are independent
-- questions with their own fixed option sets (Self/Immediate Family/Family, Economy/Business).
-- Text rather than an enum: the column follows the same free-text-with-a-suggested-list pattern
-- as the rest of Candidate Profile's compensation fields, so it can hold values entered before
-- the option list existed or before it grows.

alter table public."Candidate Profile"
    add column if not exists flight_hometown_cover text,
    add column if not exists flight_hometown_class text;

comment on column public."Candidate Profile".flight_hometown_cover is 'Who the flight-home benefit covers: Self | Immediate Family | Family.';
comment on column public."Candidate Profile".flight_hometown_class is 'Cabin class flown: Economy | Business.';
