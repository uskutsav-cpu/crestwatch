import {describe,it,expect} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import About from '@/app/about/page';
import Methodology from '@/app/methodology/page';
import Evidence from '@/app/evidence/page';
describe('Public claims and provenance',()=>{
 it('explains substantial automated contributions without implying automated forecasts',()=>{const html=renderToStaticMarkup(React.createElement(About));expect(html).toContain('automated coding tools contributed substantially');expect(html).toContain('uses no automated to produce river forecasts')});
 it('does not present unperformed field validation as evidence',()=>{const html=renderToStaticMarkup(React.createElement(Evidence));expect(html).toContain('No independent property inundation validation is claimed');expect(html).toContain('unfilled field-test rows')});
 it('explains datum, connectivity, and alert limitations',()=>{const html=renderToStaticMarkup(React.createElement(Methodology));for(const term of ['NAVD88','NGVD29','levees','Checks and delivery can be delayed or missed','not an all-clear'])expect(html).toContain(term)});
});
