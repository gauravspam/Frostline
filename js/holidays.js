// Frostline static festival calendar. No network, no API, no fetch: the new tab
// must stay instant and permission-free, so every date lives in the repo.
// Lunisolar dates (Hindu, Islamic) shift yearly and were verified per year
// against Drik Panchang, Prokerala, timeanddate and USC ORSL tables; a one-day
// regional variance is inherent to tithi/moon sighting, not an error.
// Shape: a festival may span days. s/e are inclusive MM-DD in the festival's
// own year, so a multi-day festival renders once under its real name (Holi,
// Navratri, Diwali, Ramadan) instead of one pointless row per day.
// Cross-year ranges (end < start) are expanded by app.js.
const FESTIVALS = {
  'Indian - Hindu': {
    annual: [
      { n: 'Makar Sankranti', i: '🪁', s: '01-14' },
      { n: 'Pongal', i: '🌾', s: '01-14', e: '01-17', obs: [{ d: '01-14', n: 'Bhogi Pongal' }, { d: '01-15', n: 'Thai Pongal' }, { d: '01-16', n: 'Mattu Pongal' }, { d: '01-17', n: 'Kaanum Pongal' }] },
      { n: 'Vishu', i: '🌼', s: '04-14' },
      { n: 'Baisakhi', i: '🌾', s: '04-14' },
      { n: 'Gandhi Jayanti', i: '🕊️', s: '10-02' },
      { n: 'Christmas', i: '🎄', s: '12-25' }
    ],
    years: {
      2026: [
        { n: 'Maha Shivaratri', i: '🕉️', s: '02-15' },
        { n: 'Holi', i: '🎨', s: '03-03', e: '03-04', v: 'Holika Dahan, Rangwali Holi', obs: [{ d: '03-03', n: 'Holika Dahan' }, { d: '03-04', n: 'Holi' }] },
        { n: 'Ugadi', i: '🌱', s: '03-19' },
        { n: 'Gudi Padwa', i: '🪁', s: '03-19' },
        { n: 'Chaitra Navratri', i: '🛕', s: '03-19', e: '03-27', obs: [{ d: '03-19', n: 'Chaitra Navratri begins' }, { d: '03-27', n: 'Chaitra Navratri ends' }] },
        { n: 'Ram Navami', i: '🏹', s: '03-26' },
        { n: 'Mahavir Jayanti', i: '🕉️', s: '03-31' },
        { n: 'Hanuman Jayanti', i: '🐒', s: '04-02' },
        { n: 'Buddha Purnima', i: '☸️', s: '05-01' },
        { n: 'Onam', i: '🌻', s: '08-17', e: '08-26', obs: [{ d: '08-17', n: 'Atham' }, { d: '08-26', n: 'Thiruvonam' }] },
        { n: 'Raksha Bandhan', i: '🎀', s: '08-28' },
        { n: 'Krishna Janmashtami', i: '🦚', s: '09-04' },
        { n: 'Ganesh Chaturthi', i: '🐘', s: '09-14', e: '09-25', v: 'Ganeshotsav, ends Anant Chaturdashi', obs: [{ d: '09-14', n: 'Ganesh Chaturthi' }, { d: '09-25', n: 'Anant Chaturdashi' }] },
        { n: 'Sharad Navratri', i: '🛕', s: '10-11', e: '10-19', obs: [{ d: '10-11', n: 'Sharad Navratri begins' }, { d: '10-19', n: 'Sharad Navratri ends' }] },
        { n: 'Durga Puja', i: '🪔', s: '10-17', e: '10-19', obs: [{ d: '10-17', n: 'Durga Puja begins' }, { d: '10-19', n: 'Durga Puja ends' }] },
        { n: 'Dussehra', i: '🏹', s: '10-20' },
        { n: 'Karwa Chauth', i: '🌙', s: '10-29' },
        { n: 'Diwali', i: '🪔', s: '11-06', e: '11-11', v: 'Dhanteras to Bhai Dooj', obs: [{ d: '11-06', n: 'Dhanteras' }, { d: '11-07', n: 'Choti Diwali' }, { d: '11-08', n: 'Diwali' }, { d: '11-10', n: 'Govardhan Puja' }, { d: '11-11', n: 'Bhai Dooj' }] },
        { n: 'Chhath Puja', i: '🌞', s: '11-13', e: '11-16', obs: [{ d: '11-13', n: 'Nahay Khay' }, { d: '11-14', n: 'Kharna' }, { d: '11-15', n: 'Sandhya Arghya' }, { d: '11-16', n: 'Usha Arghya' }] },
        { n: 'Guru Nanak Jayanti', i: '🙏', s: '11-24' }
      ],
      2027: [
        { n: 'Maha Shivaratri', i: '🕉️', s: '03-06' },
        { n: 'Holi', i: '🎨', s: '03-21', e: '03-22', v: 'Holika Dahan, Rangwali Holi', obs: [{ d: '03-21', n: 'Holika Dahan' }, { d: '03-22', n: 'Holi' }] },
        { n: 'Chaitra Navratri', i: '🛕', s: '04-07', e: '04-15', obs: [{ d: '04-07', n: 'Chaitra Navratri begins' }, { d: '04-15', n: 'Chaitra Navratri ends' }] },
        { n: 'Ram Navami', i: '🏹', s: '04-15' },
        { n: 'Ugadi', i: '🌱', s: '04-07' },
        { n: 'Gudi Padwa', i: '🪁', s: '04-07' },
        { n: 'Mahavir Jayanti', i: '🕉️', s: '04-19' },
        { n: 'Buddha Purnima', i: '☸️', s: '05-20' },
        { n: 'Krishna Janmashtami', i: '🦚', s: '08-25' },
        { n: 'Raksha Bandhan', i: '🎀', s: '08-17' },
        { n: 'Ganesh Chaturthi', i: '🐘', s: '09-04', e: '09-15', v: 'Ganeshotsav, ends Anant Chaturdashi', obs: [{ d: '09-04', n: 'Ganesh Chaturthi' }, { d: '09-15', n: 'Anant Chaturdashi' }] },
        { n: 'Onam', i: '🌻', s: '09-03', e: '09-12', obs: [{ d: '09-03', n: 'Atham' }, { d: '09-12', n: 'Thiruvonam' }] },
        { n: 'Sharad Navratri', i: '🛕', s: '09-30', e: '10-08', obs: [{ d: '09-30', n: 'Sharad Navratri begins' }, { d: '10-08', n: 'Sharad Navratri ends' }] },
        { n: 'Durga Puja', i: '🪔', s: '10-06', e: '10-08', obs: [{ d: '10-06', n: 'Durga Puja begins' }, { d: '10-08', n: 'Durga Puja ends' }] },
        { n: 'Dussehra', i: '🏹', s: '10-09' },
        { n: 'Karwa Chauth', i: '🌙', s: '10-18' },
        { n: 'Diwali', i: '🪔', s: '10-27', e: '10-31', v: 'Dhanteras to Bhai Dooj', obs: [{ d: '10-27', n: 'Dhanteras' }, { d: '10-28', n: 'Choti Diwali' }, { d: '10-29', n: 'Diwali' }, { d: '10-30', n: 'Govardhan Puja' }, { d: '10-31', n: 'Bhai Dooj' }] },
        { n: 'Chhath Puja', i: '🌞', s: '11-02', e: '11-05', obs: [{ d: '11-02', n: 'Nahay Khay' }, { d: '11-03', n: 'Kharna' }, { d: '11-04', n: 'Sandhya Arghya' }, { d: '11-05', n: 'Usha Arghya' }] },
        { n: 'Guru Nanak Jayanti', i: '🙏', s: '11-14' }
      ],
      2028: [
        { n: 'Maha Shivaratri', i: '🕉️', s: '02-23' },
        { n: 'Holi', i: '🎨', s: '03-10', e: '03-11', v: 'Holika Dahan, Rangwali Holi', obs: [{ d: '03-10', n: 'Holika Dahan' }, { d: '03-11', n: 'Holi' }] },
        { n: 'Ugadi', i: '🌱', s: '03-27' },
        { n: 'Gudi Padwa', i: '🪁', s: '03-27' },
        { n: 'Chaitra Navratri', i: '🛕', s: '03-27', e: '04-04', obs: [{ d: '03-27', n: 'Chaitra Navratri begins' }, { d: '04-04', n: 'Chaitra Navratri ends' }] },
        { n: 'Ram Navami', i: '🏹', s: '04-03' },
        { n: 'Mahavir Jayanti', i: '🕉️', s: '04-07' },
        { n: 'Buddha Purnima', i: '☸️', s: '05-08' },
        { n: 'Raksha Bandhan', i: '🎀', s: '08-05' },
        { n: 'Onam', i: '🌻', s: '08-23', e: '09-01', obs: [{ d: '08-23', n: 'Atham' }, { d: '09-01', n: 'Thiruvonam' }] },
        { n: 'Krishna Janmashtami', i: '🦚', s: '08-13' },
        { n: 'Ganesh Chaturthi', i: '🐘', s: '08-23', e: '09-03', v: 'Ganeshotsav, ends Anant Chaturdashi', obs: [{ d: '08-23', n: 'Ganesh Chaturthi' }, { d: '09-03', n: 'Anant Chaturdashi' }] },
        { n: 'Sharad Navratri', i: '🛕', s: '09-19', e: '09-27', obs: [{ d: '09-19', n: 'Sharad Navratri begins' }, { d: '09-27', n: 'Sharad Navratri ends' }] },
        { n: 'Durga Puja', i: '🪔', s: '09-25', e: '09-27', obs: [{ d: '09-25', n: 'Durga Puja begins' }, { d: '09-27', n: 'Durga Puja ends' }] },
        { n: 'Dussehra', i: '🏹', s: '09-27' },
        { n: 'Karwa Chauth', i: '🌙', s: '10-07' },
        { n: 'Diwali', i: '🪔', s: '10-15', e: '10-19', v: 'Dhanteras to Bhai Dooj', obs: [{ d: '10-15', n: 'Dhanteras' }, { d: '10-16', n: 'Choti Diwali' }, { d: '10-17', n: 'Diwali' }, { d: '10-18', n: 'Govardhan Puja' }, { d: '10-19', n: 'Bhai Dooj' }] },
        { n: 'Chhath Puja', i: '🌞', s: '10-21', e: '10-24', obs: [{ d: '10-21', n: 'Nahay Khay' }, { d: '10-22', n: 'Kharna' }, { d: '10-23', n: 'Sandhya Arghya' }, { d: '10-24', n: 'Usha Arghya' }] },
        { n: 'Guru Nanak Jayanti', i: '🙏', s: '11-02' }
      ]
    }
  },

  'Indian - Muslim': {
    years: {
      2026: [
        { n: 'Ramadan', i: '🌙', s: '02-18', e: '03-19', v: 'Month of fasting', obs: [{ d: '02-18', n: 'Ramadan begins' }, { d: '03-19', n: 'Ramadan ends' }] },
        { n: 'Eid al-Fitr', i: '🌙', s: '03-20' },
        { n: 'Eid al-Adha', i: '🐐', s: '05-27' },
        { n: 'Islamic New Year', i: '🌙', s: '06-16' },
        { n: 'Ashura', i: '🌙', s: '06-25' },
        { n: 'Milad-un-Nabi', i: '🕌', s: '08-26' }
      ],
      2027: [
        { n: 'Ramadan', i: '🌙', s: '02-08', e: '03-08', v: 'Month of fasting', obs: [{ d: '02-08', n: 'Ramadan begins' }, { d: '03-08', n: 'Ramadan ends' }] },
        { n: 'Eid al-Fitr', i: '🌙', s: '03-09' },
        { n: 'Eid al-Adha', i: '🐐', s: '05-16' },
        { n: 'Islamic New Year', i: '🌙', s: '06-06' },
        { n: 'Ashura', i: '🌙', s: '06-15' },
        { n: 'Milad-un-Nabi', i: '🕌', s: '08-14' }
      ],
      2028: [
        { n: 'Ramadan', i: '🌙', s: '01-28', e: '02-25', v: 'Month of fasting', obs: [{ d: '01-28', n: 'Ramadan begins' }, { d: '02-25', n: 'Ramadan ends' }] },
        { n: 'Eid al-Fitr', i: '🌙', s: '02-26' },
        { n: 'Eid al-Adha', i: '🐐', s: '05-05' },
        { n: 'Islamic New Year', i: '🌙', s: '05-25' },
        { n: 'Ashura', i: '🌙', s: '06-03' },
        { n: 'Milad-un-Nabi', i: '🕌', s: '08-03' }
      ]
    }
  },

  India: {
    annual: [
      { n: 'Republic Day', i: '🇮🇳', s: '01-26' },
      { n: 'Independence Day', i: '🇮🇳', s: '08-15' },
      { n: 'Gandhi Jayanti', i: '🕊️', s: '10-02' },
      { n: 'Christmas', i: '🎄', s: '12-25' }
    ],
    years: {
      2026: [
        { n: 'Maha Shivaratri', i: '🕉️', s: '02-15' },
        { n: 'Holi', i: '🎨', s: '03-04' },
        { n: 'Eid al-Fitr', i: '🌙', s: '03-20' },
        { n: 'Buddha Purnima', i: '☸️', s: '05-01' },
        { n: 'Eid al-Adha', i: '🐐', s: '05-27' },
        { n: 'Milad-un-Nabi', i: '🕌', s: '08-26' },
        { n: 'Krishna Janmashtami', i: '🦚', s: '09-04' },
        { n: 'Dussehra', i: '🏹', s: '10-20' },
        { n: 'Diwali', i: '🪔', s: '11-08' },
        { n: 'Guru Nanak Jayanti', i: '🙏', s: '11-24' }
      ],
      2027: [
        { n: 'Maha Shivaratri', i: '🕉️', s: '03-06' },
        { n: 'Holi', i: '🎨', s: '03-22' },
        { n: 'Eid al-Fitr', i: '🌙', s: '03-09' },
        { n: 'Buddha Purnima', i: '☸️', s: '05-20' },
        { n: 'Eid al-Adha', i: '🐐', s: '05-16' },
        { n: 'Milad-un-Nabi', i: '🕌', s: '08-14' },
        { n: 'Krishna Janmashtami', i: '🦚', s: '08-25' },
        { n: 'Dussehra', i: '🏹', s: '10-09' },
        { n: 'Diwali', i: '🪔', s: '10-29' },
        { n: 'Guru Nanak Jayanti', i: '🙏', s: '11-14' }
      ],
      2028: [
        { n: 'Maha Shivaratri', i: '🕉️', s: '02-23' },
        { n: 'Holi', i: '🎨', s: '03-11' },
        { n: 'Eid al-Fitr', i: '🌙', s: '02-26' },
        { n: 'Buddha Purnima', i: '☸️', s: '05-08' },
        { n: 'Eid al-Adha', i: '🐐', s: '05-05' },
        { n: 'Milad-un-Nabi', i: '🕌', s: '08-03' },
        { n: 'Krishna Janmashtami', i: '🦚', s: '08-13' },
        { n: 'Dussehra', i: '🏹', s: '09-27' },
        { n: 'Diwali', i: '🪔', s: '10-17' },
        { n: 'Guru Nanak Jayanti', i: '🙏', s: '11-02' }
      ]
    }
  },

  Japan: {
    years: {
      2026: [
        { n: 'Coming of Age Day', i: '🎎', s: '01-12' },
        { n: 'National Foundation Day', i: '🏯', s: '02-11' },
        { n: "Emperor's Birthday", i: '🎂', s: '02-23' },
        { n: 'Showa Day', i: '🌸', s: '04-29' },
        { n: 'Constitution Day', i: '📜', s: '05-03' },
        { n: 'Greenery Day', i: '🌿', s: '05-04' },
        { n: "Children's Day", i: '🎏', s: '05-05' },
        { n: 'Marine Day', i: '🌊', s: '07-20' },
        { n: 'Mountain Day', i: '⛰️', s: '08-11' },
        { n: 'Respect for the Aged Day', i: '👴', s: '09-21' },
        { n: 'Autumnal Equinox', i: '🍂', s: '09-23' },
        { n: 'Culture Day', i: '🎭', s: '11-03' },
        { n: 'Labor Thanksgiving Day', i: '🌾', s: '11-23' }
      ],
      2027: [
        { n: 'Coming of Age Day', i: '🎎', s: '01-11' },
        { n: 'National Foundation Day', i: '🏯', s: '02-11' },
        { n: "Emperor's Birthday", i: '🎂', s: '02-23' },
        { n: 'Showa Day', i: '🌸', s: '04-29' },
        { n: 'Constitution Day', i: '📜', s: '05-03' },
        { n: 'Greenery Day', i: '🌿', s: '05-04' },
        { n: "Children's Day", i: '🎏', s: '05-05' },
        { n: 'Marine Day', i: '🌊', s: '07-19' },
        { n: 'Mountain Day', i: '⛰️', s: '08-11' },
        { n: 'Respect for the Aged Day', i: '👴', s: '09-20' },
        { n: 'Autumnal Equinox', i: '🍂', s: '09-23' },
        { n: 'Culture Day', i: '🎭', s: '11-03' },
        { n: 'Labor Thanksgiving Day', i: '🌾', s: '11-23' }
      ],
      2028: [
        { n: 'Coming of Age Day', i: '🎎', s: '01-10' },
        { n: 'National Foundation Day', i: '🏯', s: '02-11' },
        { n: "Emperor's Birthday", i: '🎂', s: '02-23' },
        { n: 'Showa Day', i: '🌸', s: '04-29' },
        { n: 'Constitution Day', i: '📜', s: '05-03' },
        { n: 'Greenery Day', i: '🌿', s: '05-04' },
        { n: "Children's Day", i: '🎏', s: '05-05' },
        { n: 'Marine Day', i: '🌊', s: '07-17' },
        { n: 'Mountain Day', i: '⛰️', s: '08-11' },
        { n: 'Respect for the Aged Day', i: '👴', s: '09-18' },
        { n: 'Autumnal Equinox', i: '🍂', s: '09-22' },
        { n: 'Culture Day', i: '🎭', s: '11-03' },
        { n: 'Labor Thanksgiving Day', i: '🌾', s: '11-23' }
      ]
    }
  },

  'General': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-03' },
        { n: 'Easter Monday', i: '🎉', s: '04-06' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'Mother’s Day', i: '💕', s: '05-10' },
        { n: 'Father’s Day', i: '👦', s: '06-21' },
        { n: 'Christmas', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '03-26' },
        { n: 'Easter Monday', i: '🎉', s: '03-29' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'Mother’s Day', i: '💕', s: '05-09' },
        { n: 'Father’s Day', i: '👦', s: '06-20' },
        { n: 'Christmas', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-14' },
        { n: 'Easter Monday', i: '🎉', s: '04-17' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'Mother’s Day', i: '💕', s: '05-14' },
        { n: 'Father’s Day', i: '👦', s: '06-18' },
        { n: 'Christmas', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
    }
  },

  'United Kingdom': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-03' },
        { n: 'Easter Monday', i: '🐰', s: '04-06' },
        { n: 'Early May Bank Holiday', i: '🌴', s: '05-04' },
        { n: 'Spring Bank Holiday', i: '🌿', s: '05-25' },
        { n: 'Summer Bank Holiday', i: '⛱', s: '08-31' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '03-26' },
        { n: 'Easter Monday', i: '🐰', s: '03-29' },
        { n: 'Early May Bank Holiday', i: '🌴', s: '05-03' },
        { n: 'Spring Bank Holiday', i: '🌿', s: '05-31' },
        { n: 'Summer Bank Holiday', i: '⛱', s: '08-30' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-14' },
        { n: 'Easter Monday', i: '🐰', s: '04-17' },
        { n: 'Early May Bank Holiday', i: '🌴', s: '05-01' },
        { n: 'Spring Bank Holiday', i: '🌿', s: '05-29' },
        { n: 'Summer Bank Holiday', i: '⛱', s: '08-28' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
    }
  },

  'Canada': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-03' },
        { n: 'Easter Monday', i: '🐰', s: '04-06' },
        { n: 'Victoria Day', i: '👑', s: '05-18' },
        { n: 'Canada Day', i: '🇨🇦', s: '07-01' },
        { n: 'Labour Day', i: '👷', s: '09-07' },
        { n: 'Thanksgiving', i: '🦃', s: '10-12' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '03-26' },
        { n: 'Easter Monday', i: '🐰', s: '03-29' },
        { n: 'Victoria Day', i: '👑', s: '05-24' },
        { n: 'Canada Day', i: '🇨🇦', s: '07-01' },
        { n: 'Labour Day', i: '👷', s: '09-06' },
        { n: 'Thanksgiving', i: '🦃', s: '10-11' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-14' },
        { n: 'Easter Monday', i: '🐰', s: '04-17' },
        { n: 'Victoria Day', i: '👑', s: '05-22' },
        { n: 'Canada Day', i: '🇨🇦', s: '07-01' },
        { n: 'Labour Day', i: '👷', s: '09-04' },
        { n: 'Thanksgiving', i: '🦃', s: '10-09' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
    }
  },

  'Australia': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Australia Day', i: '🇦🇺', s: '01-26' },
        { n: 'Good Friday', i: '⛪', s: '04-03' },
        { n: 'Easter Monday', i: '🐰', s: '04-06' },
        { n: 'Anzac Day', i: '🌺', s: '04-25' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Australia Day', i: '🇦🇺', s: '01-26' },
        { n: 'Good Friday', i: '⛪', s: '03-26' },
        { n: 'Easter Monday', i: '🐰', s: '03-29' },
        { n: 'Anzac Day', i: '🌺', s: '04-25' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Australia Day', i: '🇦🇺', s: '01-26' },
        { n: 'Good Friday', i: '⛪', s: '04-14' },
        { n: 'Easter Monday', i: '🐰', s: '04-17' },
        { n: 'Anzac Day', i: '🌺', s: '04-25' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Boxing Day', i: '🎁', s: '12-26' },
      ],
    }
  },

  'Germany': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-03' },
        { n: 'Easter Monday', i: '🐰', s: '04-06' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'German Unity Day', i: '🇩🇪', s: '10-03' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Second Christmas Day', i: '🎁', s: '12-26' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '03-26' },
        { n: 'Easter Monday', i: '🐰', s: '03-29' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'German Unity Day', i: '🇩🇪', s: '10-03' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Second Christmas Day', i: '🎁', s: '12-26' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Good Friday', i: '⛪', s: '04-14' },
        { n: 'Easter Monday', i: '🐰', s: '04-17' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'German Unity Day', i: '🇩🇪', s: '10-03' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
        { n: 'Second Christmas Day', i: '🎁', s: '12-26' },
      ],
    }
  },

  'France': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Easter Monday', i: '🐰', s: '04-06' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'Victory Day', i: '🕊', s: '05-08' },
        { n: 'Bastille Day', i: '🇫🇷', s: '07-14' },
        { n: 'Assumption Day', i: '⛪', s: '08-15' },
        { n: 'All Saints\' Day', i: '🕯', s: '11-01' },
        { n: 'Armistice Day', i: '🕊', s: '11-11' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Easter Monday', i: '🐰', s: '03-29' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'Victory Day', i: '🕊', s: '05-08' },
        { n: 'Bastille Day', i: '🇫🇷', s: '07-14' },
        { n: 'Assumption Day', i: '⛪', s: '08-15' },
        { n: 'All Saints\' Day', i: '🕯', s: '11-01' },
        { n: 'Armistice Day', i: '🕊', s: '11-11' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Easter Monday', i: '🐰', s: '04-17' },
        { n: 'Labour Day', i: '🌹', s: '05-01' },
        { n: 'Victory Day', i: '🕊', s: '05-08' },
        { n: 'Bastille Day', i: '🇫🇷', s: '07-14' },
        { n: 'Assumption Day', i: '⛪', s: '08-15' },
        { n: 'All Saints\' Day', i: '🕯', s: '11-01' },
        { n: 'Armistice Day', i: '🕊', s: '11-11' },
        { n: 'Christmas Day', i: '🎄', s: '12-25' },
      ],
    }
  },

  'United States': {
    years: {
      2026: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Martin Luther King Jr. Day', i: '🕊', s: '01-19' },
        { n: 'Presidents\' Day', i: '🏛', s: '02-16' },
        { n: 'Memorial Day', i: '🎖', s: '05-25' },
        { n: 'Independence Day', i: '🇺🇸', s: '07-04' },
        { n: 'Labor Day', i: '👷', s: '09-07' },
        { n: 'Halloween', i: '🎃', s: '10-31' },
        { n: 'Veterans Day', i: '🎖', s: '11-11' },
        { n: 'Thanksgiving', i: '🦃', s: '11-26' },
        { n: 'Christmas', i: '🎄', s: '12-25' },
      ],
      2027: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Martin Luther King Jr. Day', i: '🕊', s: '01-18' },
        { n: 'Presidents\' Day', i: '🏛', s: '02-15' },
        { n: 'Memorial Day', i: '🎖', s: '05-31' },
        { n: 'Independence Day', i: '🇺🇸', s: '07-04' },
        { n: 'Labor Day', i: '👷', s: '09-06' },
        { n: 'Halloween', i: '🎃', s: '10-31' },
        { n: 'Veterans Day', i: '🎖', s: '11-11' },
        { n: 'Thanksgiving', i: '🦃', s: '11-25' },
        { n: 'Christmas', i: '🎄', s: '12-25' },
      ],
      2028: [
        { n: 'New Year\'s Day', i: '🎆', s: '01-01' },
        { n: 'Martin Luther King Jr. Day', i: '🕊', s: '01-17' },
        { n: 'Presidents\' Day', i: '🏛', s: '02-21' },
        { n: 'Memorial Day', i: '🎖', s: '05-29' },
        { n: 'Independence Day', i: '🇺🇸', s: '07-04' },
        { n: 'Labor Day', i: '👷', s: '09-04' },
        { n: 'Halloween', i: '🎃', s: '10-31' },
        { n: 'Veterans Day', i: '🎖', s: '11-11' },
        { n: 'Thanksgiving', i: '🦃', s: '11-23' },
        { n: 'Christmas', i: '🎄', s: '12-25' },
      ],
    }
  },
};
