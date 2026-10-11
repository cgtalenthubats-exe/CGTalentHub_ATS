-- "Family" and "Immediate Family" meant the same thing for the flight-home benefit; the form now
-- offers only Self | Immediate Family, so fold any stored "Family" values into "Immediate Family".

update public."Candidate Profile"
set flight_hometown_cover = 'Immediate Family'
where flight_hometown_cover = 'Family';

comment on column public."Candidate Profile".flight_hometown_cover is 'Who the flight-home benefit covers: Self | Immediate Family.';
