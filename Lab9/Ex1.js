var month = 6;
var day = 3;
var year = 2001;

step1 = year - 2000;
step2 =  parseInt(step1/4);
step3 = step1 + step2;
step4 = 4;
step6 = step4 + step3;
step7 = day + step6;
step8 = step7;
step9 = step8 - 1; // not a leap year
step10 = step9 % 7;



console.log(step10);