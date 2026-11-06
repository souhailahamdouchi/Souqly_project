<?php

namespace App\Enums;

enum PayoutStatus: string
{
    case EN_ATTENTE = 'EN_ATTENTE';
    case VERSE = 'VERSE';
    case ECHOUE = 'ECHOUE';
}
