/** Original cartographic illustration; the interactive map below shows real geography. */
export function RiverVisual() {
  const river = "M367 -90 C286 3 442 55 414 135 C391 202 228 165 234 249 C242 336 439 270 443 366 C448 449 258 395 263 493 C268 577 435 528 407 638 C388 707 302 741 347 833";
  return (
    <div className="river-visual" aria-hidden="true">
      <svg viewBox="0 0 680 760" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="field-lines" width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path d="M0 0V13" stroke="#b9bda0" strokeWidth=".65" /></pattern>
          <pattern id="orchard" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.4" fill="#7c9276" /></pattern>
        </defs>
        <rect width="680" height="760" fill="#dedfc9" />
        <path d="M0 0H272L208 153L40 218L0 170Z M479 0H680V245L578 198L506 116Z M0 435L145 421L218 552L115 760H0Z M482 438L680 352V760H497L524 622Z" fill="#c3cbb0" />
        <path d="M0 0H272L208 153L40 218L0 170Z M482 438L680 352V760H497L524 622Z" fill="url(#field-lines)" />
        <path d="M12 275L138 219L193 322L71 386Z M511 84L651 122L612 233L490 191Z M67 575L165 599L112 741L8 720Z M527 477L652 432L680 567L557 613Z" fill="url(#orchard)" />
        <g stroke="#f5f1df" strokeWidth="3"><path d="M-20 187L178 126L311 -20 M492 -20L525 286L698 338 M-20 499L174 372L232 803 M474 804L526 579L700 635" /><path d="M-30 369L198 409L531 327L700 404" strokeWidth="6" /></g>
        <g stroke="#a5af92" strokeWidth=".8" opacity=".7"><path d="M0 241L166 179L213 88 M552 0L577 260L680 295 M0 559L124 479L174 760 M565 760L592 610L680 579" /><path d="M0 262L179 199L231 93 M573 0L597 245L680 274 M0 581L108 510L149 760 M587 760L613 633L680 605" /></g>
        {[141,119,97].map((width,i)=><path key={width} d={river} stroke={['#b7c4a7','#cbd0b5','#e8e3c8'][i]} strokeWidth={width} />)}
        <path d={river} stroke="#315e58" strokeWidth="65" />
        <path d={river} stroke="#557d6f" strokeWidth="49" />
        <path className="river-flow-line" d={river} stroke="#a9c2aa" strokeWidth="2" strokeDasharray="4 16" />
        <path d="M381 244C381 209 469 231 481 193C494 151 456 136 489 104 M322 571C270 612 200 584 184 627C164 675 232 695 201 752" stroke="#98ad91" strokeWidth="12" />
        <g fontFamily="Manrope, sans-serif" fontSize="9" fill="#52664f" letterSpacing="2"><text x="59" y="101">THE DELTA</text><text x="516" y="680">MISSISSIPPI</text></g>
        <g className="river-art-marker" transform="translate(442 358)"><circle r="19" fill="#f8f4e8" /><circle r="12" fill="#b85c38" /><circle r="4" fill="#fff8e8" /><path d="M21 0H72" stroke="#7c684e" /><rect x="71" y="-18" width="121" height="37" rx="2" fill="#f8f4e8" /><text x="85" y="5" fill="#314b3f" fontSize="11" fontFamily="Manrope, sans-serif">MEANDER STUDY</text></g>
        <g transform="translate(596 66)" stroke="#52664f"><path d="M0 36V0M-5 10L0 0L5 10" /><text x="0" y="-12" textAnchor="middle" stroke="none" fill="#52664f" fontSize="10" fontFamily="Manrope, sans-serif">N</text></g>
        <g transform="translate(40 683)" stroke="#52664f"><path d="M0 0V6H75V0M37.5 0V6" /><text y="24" fill="#52664f" stroke="none" fontSize="8" fontFamily="Manrope, sans-serif" letterSpacing="1">A RIVER, IN MOTION</text></g>
      </svg>
      <span className="visual-caption">A STUDY IN MEANDERS <span>ILLUSTRATION · NOT A FLOOD MAP</span></span>
    </div>
  );
}
